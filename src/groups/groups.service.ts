import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { Contribution } from './entities/contribution.entity';
import { Payout } from './entities/payout.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MarkContributionDto } from './dto/mark-contribution.dto';
import { RecordPayoutDto } from './dto/record-payout.dto';
import { currentCycleLabel, todayIso } from './cycle.util';

export interface MemberView {
  id: string;
  name: string;
  phone: string | null;
  payoutPosition: number | null;
  joinedDate: string;
  active: boolean;
  paidThisCycle: boolean;
  totalContributed: number;
}

export interface GroupDetailView {
  id: string;
  name: string;
  type: string;
  description: string;
  contributionAmount: number;
  frequency: string;
  payoutAmount: number | null;
  balance: number;
  currentCycle: string;
  nextPayoutMemberId: string | null;
  members: MemberView[];
}

export interface GroupSummaryView {
  id: string;
  name: string;
  type: string;
  description: string;
  contributionAmount: number;
  frequency: string;
  payoutAmount: number | null;
  balance: number;
  currentCycle: string;
  memberCount: number;
  paidCount: number;
  nextPayoutMemberId: string | null;
}

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private readonly groupsRepo: Repository<Group>,
    @InjectRepository(GroupMember) private readonly membersRepo: Repository<GroupMember>,
    @InjectRepository(Contribution) private readonly contributionsRepo: Repository<Contribution>,
    @InjectRepository(Payout) private readonly payoutsRepo: Repository<Payout>,
  ) {}

  // ---------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------

  private async getOwnedGroup(id: string, ownerId: string): Promise<Group> {
    const group = await this.groupsRepo.findOne({ where: { id, ownerId } });
    if (!group) {
      throw new NotFoundException(`Group ${id} not found`);
    }
    return group;
  }

  /** Sum of everything actually paid in, minus everything actually paid
   * out — the real running balance, not a stored number that can drift
   * from the ledger underneath it. */
  private async computeBalance(groupId: string): Promise<number> {
    const [paidIn, paidOut] = await Promise.all([
      this.contributionsRepo
        .createQueryBuilder('c')
        .select('COALESCE(SUM(c.amount), 0)', 'total')
        .where('c.groupId = :groupId AND c.status = :status', { groupId, status: 'Paid' })
        .getRawOne<{ total: string }>(),
      this.payoutsRepo
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount), 0)', 'total')
        .where('p.groupId = :groupId', { groupId })
        .getRawOne<{ total: string }>(),
    ]);
    return Number(paidIn?.total ?? 0) - Number(paidOut?.total ?? 0);
  }

  async findAll(ownerId: string): Promise<GroupSummaryView[]> {
    const groups = await this.groupsRepo.find({ where: { ownerId }, order: { createdAt: 'ASC' } });
    return Promise.all(groups.map((g) => this.toSummary(g)));
  }

  private async toSummary(group: Group): Promise<GroupSummaryView> {
    const members = await this.membersRepo.find({ where: { groupId: group.id, active: true } });
    const cycle = currentCycleLabel(group.frequency);
    const paidRows = await this.contributionsRepo.find({
      where: { groupId: group.id, cyclePeriod: cycle, status: 'Paid' },
    });
    const paidMemberIds = new Set(paidRows.map((r) => r.memberId));
    const balance = await this.computeBalance(group.id);
    const nextPayoutMemberId = this.resolveNextPayoutMemberId(group, members);

    return {
      id: group.id,
      name: group.name,
      type: group.type,
      description: group.description,
      contributionAmount: group.contributionAmount,
      frequency: group.frequency,
      payoutAmount: group.payoutAmount,
      balance,
      currentCycle: cycle,
      memberCount: members.length,
      paidCount: members.filter((m) => paidMemberIds.has(m.id)).length,
      nextPayoutMemberId,
    };
  }

  async findOne(id: string, ownerId: string): Promise<GroupDetailView> {
    const group = await this.getOwnedGroup(id, ownerId);
    const members = await this.membersRepo.find({ where: { groupId: id }, order: { joinedDate: 'ASC' } });
    const cycle = currentCycleLabel(group.frequency);

    const [paidThisCycleRows, allPaidRows] = await Promise.all([
      this.contributionsRepo.find({ where: { groupId: id, cyclePeriod: cycle, status: 'Paid' } }),
      this.contributionsRepo.find({ where: { groupId: id, status: 'Paid' } }),
    ]);
    const paidThisCycleIds = new Set(paidThisCycleRows.map((r) => r.memberId));
    const totalByMember = new Map<string, number>();
    for (const row of allPaidRows) {
      totalByMember.set(row.memberId, (totalByMember.get(row.memberId) ?? 0) + row.amount);
    }

    const balance = await this.computeBalance(id);
    const activeMembers = members.filter((m) => m.active);
    const nextPayoutMemberId = this.resolveNextPayoutMemberId(group, activeMembers);

    return {
      id: group.id,
      name: group.name,
      type: group.type,
      description: group.description,
      contributionAmount: group.contributionAmount,
      frequency: group.frequency,
      payoutAmount: group.payoutAmount,
      balance,
      currentCycle: cycle,
      nextPayoutMemberId,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        phone: m.phone,
        payoutPosition: m.payoutPosition,
        joinedDate: m.joinedDate,
        active: m.active,
        paidThisCycle: paidThisCycleIds.has(m.id),
        totalContributed: totalByMember.get(m.id) ?? 0,
      })),
    };
  }

  private resolveNextPayoutMemberId(group: Group, activeMembers: GroupMember[]): string | null {
    if (group.type !== 'stokvel' || group.nextPayoutPosition == null) return null;
    const match = activeMembers.find((m) => m.payoutPosition === group.nextPayoutPosition);
    return match?.id ?? null;
  }

  async create(dto: CreateGroupDto, ownerId: string): Promise<Group> {
    const group = this.groupsRepo.create({
      ...dto,
      ownerId,
      payoutAmount: dto.payoutAmount ?? null,
      nextPayoutPosition: null,
    });
    return this.groupsRepo.save(group);
  }

  async update(id: string, dto: UpdateGroupDto, ownerId: string): Promise<Group> {
    const group = await this.getOwnedGroup(id, ownerId);
    Object.assign(group, dto);
    return this.groupsRepo.save(group);
  }

  async remove(id: string, ownerId: string): Promise<{ message: string }> {
    const result = await this.groupsRepo.delete({ id, ownerId });
    if (result.affected === 0) {
      throw new NotFoundException(`Group ${id} not found`);
    }
    return { message: 'Group removed.' };
  }

  // ---------------------------------------------------------------------
  // Members
  // ---------------------------------------------------------------------

  async addMember(groupId: string, dto: CreateMemberDto, ownerId: string): Promise<GroupMember> {
    const group = await this.getOwnedGroup(groupId, ownerId);

    let payoutPosition: number | null = null;
    if (group.type === 'stokvel') {
      const existing = await this.membersRepo.find({ where: { groupId } });
      const maxPosition = existing.reduce((max, m) => Math.max(max, m.payoutPosition ?? 0), 0);
      payoutPosition = maxPosition + 1;
    }

    const member = await this.membersRepo.save(
      this.membersRepo.create({
        groupId,
        name: dto.name,
        phone: dto.phone ?? null,
        joinedDate: dto.joinedDate ?? todayIso(),
        payoutPosition,
        active: true,
      }),
    );

    // First member of a stokvel becomes the initial "next up" automatically.
    if (group.type === 'stokvel' && group.nextPayoutPosition == null) {
      group.nextPayoutPosition = payoutPosition;
      await this.groupsRepo.save(group);
    }

    return member;
  }

  private async getOwnedMember(groupId: string, memberId: string, ownerId: string): Promise<GroupMember> {
    await this.getOwnedGroup(groupId, ownerId);
    const member = await this.membersRepo.findOne({ where: { id: memberId, groupId } });
    if (!member) {
      throw new NotFoundException(`Member ${memberId} not found`);
    }
    return member;
  }

  async updateMember(
    groupId: string,
    memberId: string,
    dto: UpdateMemberDto,
    ownerId: string,
  ): Promise<GroupMember> {
    const member = await this.getOwnedMember(groupId, memberId, ownerId);
    Object.assign(member, dto);
    return this.membersRepo.save(member);
  }

  async removeMember(groupId: string, memberId: string, ownerId: string): Promise<{ message: string }> {
    const member = await this.getOwnedMember(groupId, memberId, ownerId);
    await this.membersRepo.remove(member);
    return { message: 'Member removed.' };
  }

  // ---------------------------------------------------------------------
  // Contributions
  // ---------------------------------------------------------------------

  /**
   * Marks a member Paid for a cycle (defaults to the group's current
   * cycle). Upserts rather than always inserting — recording a payment
   * twice for the same cycle updates the same row instead of creating a
   * duplicate, so the unique (groupId, memberId, cyclePeriod) index holds.
   */
  async markPaid(
    groupId: string,
    memberId: string,
    dto: MarkContributionDto,
    ownerId: string,
  ): Promise<Contribution> {
    const group = await this.getOwnedGroup(groupId, ownerId);
    const member = await this.getOwnedMember(groupId, memberId, ownerId);
    if (!member.active) {
      throw new BadRequestException('Cannot record a contribution for an inactive member.');
    }

    const cyclePeriod = dto.cyclePeriod ?? currentCycleLabel(group.frequency);
    let contribution = await this.contributionsRepo.findOne({ where: { groupId, memberId, cyclePeriod } });

    if (contribution) {
      contribution.status = 'Paid';
      contribution.amount = group.contributionAmount;
      contribution.paidDate = dto.paidDate ?? todayIso();
    } else {
      contribution = this.contributionsRepo.create({
        groupId,
        memberId,
        cyclePeriod,
        amount: group.contributionAmount,
        status: 'Paid',
        paidDate: dto.paidDate ?? todayIso(),
      });
    }

    return this.contributionsRepo.save(contribution);
  }

  async markUnpaid(
    groupId: string,
    memberId: string,
    ownerId: string,
    cyclePeriod?: string,
  ): Promise<{ message: string }> {
    const group = await this.getOwnedGroup(groupId, ownerId);
    await this.getOwnedMember(groupId, memberId, ownerId);
    const cycle = cyclePeriod ?? currentCycleLabel(group.frequency);
    await this.contributionsRepo.delete({ groupId, memberId, cyclePeriod: cycle });
    return { message: 'Contribution unmarked.' };
  }

  // ---------------------------------------------------------------------
  // Payouts
  // ---------------------------------------------------------------------

  async listPayouts(groupId: string, ownerId: string): Promise<Payout[]> {
    await this.getOwnedGroup(groupId, ownerId);
    return this.payoutsRepo.find({ where: { groupId }, order: { date: 'DESC' } });
  }

  /**
   * Records a payout and, for a stokvel, advances the rotation to whoever's
   * next — wrapping back to the lowest position once the last member in
   * the rotation has been paid.
   */
  async recordPayout(groupId: string, dto: RecordPayoutDto, ownerId: string): Promise<Payout> {
    const group = await this.getOwnedGroup(groupId, ownerId);
    const member = await this.getOwnedMember(groupId, dto.memberId, ownerId);

    const payout = await this.payoutsRepo.save(
      this.payoutsRepo.create({
        groupId,
        memberId: dto.memberId,
        amount: dto.amount,
        date: dto.date ?? todayIso(),
        cyclePeriod: group.type === 'stokvel' ? currentCycleLabel(group.frequency) : null,
        note: dto.note ?? null,
      }),
    );

    if (group.type === 'stokvel' && member.payoutPosition != null) {
      const activeMembers = await this.membersRepo.find({ where: { groupId, active: true } });
      const sorted = activeMembers
        .filter((m) => m.payoutPosition != null)
        .sort((a, b) => (a.payoutPosition ?? 0) - (b.payoutPosition ?? 0));
      const currentIndex = sorted.findIndex((m) => m.id === member.id);
      if (currentIndex !== -1 && sorted.length > 0) {
        const nextMember = sorted[(currentIndex + 1) % sorted.length];
        group.nextPayoutPosition = nextMember.payoutPosition;
        await this.groupsRepo.save(group);
      }
    }

    return payout;
  }
}
