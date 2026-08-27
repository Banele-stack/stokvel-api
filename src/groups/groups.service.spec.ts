import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { Contribution } from './entities/contribution.entity';
import { Payout } from './entities/payout.entity';
import { currentCycleLabel } from './cycle.util';

// A minimal chainable stand-in for TypeORM's QueryBuilder, just enough to
// exercise GroupsService.computeBalance's SUM(...) queries against real
// in-memory rows instead of a live Postgres connection.
class FakeSumQueryBuilder<T extends { groupId: string }> {
  private params: Record<string, unknown> = {};
  constructor(
    private readonly rows: T[],
    private readonly amountKey: keyof T,
  ) {}
  select() {
    return this;
  }
  where(_sql: string, params: Record<string, unknown>) {
    this.params = params;
    return this;
  }
  async getRawOne() {
    const filtered = this.rows.filter((r) => {
      if (r.groupId !== this.params.groupId) return false;
      if (this.params.status !== undefined && (r as any).status !== this.params.status) return false;
      return true;
    });
    const total = filtered.reduce((sum, r) => sum + (r[this.amountKey] as unknown as number), 0);
    return { total: String(total) };
  }
}

class FakeRepo<T extends { id?: string }> {
  rows: T[] = [];
  private nextId = 1;

  find({ where, order }: { where: Partial<T>; order?: Record<string, 'ASC' | 'DESC'> }) {
    let result = this.rows.filter((r) => Object.entries(where ?? {}).every(([k, v]) => (r as any)[k] === v));
    if (order) {
      const [key] = Object.keys(order);
      result = [...result].sort((a: any, b: any) => (a[key] > b[key] ? 1 : -1));
    }
    return Promise.resolve(result);
  }

  findOne({ where }: { where: Partial<T> }) {
    const row = this.rows.find((r) => Object.entries(where ?? {}).every(([k, v]) => (r as any)[k] === v));
    return Promise.resolve(row ?? null);
  }

  create(partial: Partial<T>) {
    return { id: `id-${this.nextId++}`, ...partial } as T;
  }

  save(entity: T) {
    const idx = this.rows.findIndex((r) => r.id === entity.id);
    if (idx >= 0) this.rows[idx] = entity;
    else this.rows.push(entity);
    return Promise.resolve(entity);
  }

  remove(entity: T) {
    this.rows = this.rows.filter((r) => r.id !== entity.id);
    return Promise.resolve(entity);
  }

  delete(where: Partial<T>) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !Object.entries(where).every(([k, v]) => (r as any)[k] === v));
    return Promise.resolve({ affected: before - this.rows.length });
  }
}

describe('GroupsService', () => {
  let service: GroupsService;
  let groupsRepo: FakeRepo<Group>;
  let membersRepo: FakeRepo<GroupMember>;
  let contributionsRepo: FakeRepo<Contribution>;
  let payoutsRepo: FakeRepo<Payout>;

  const OWNER_A = 'owner-a';
  const OWNER_B = 'owner-b';

  beforeEach(async () => {
    groupsRepo = new FakeRepo<Group>();
    membersRepo = new FakeRepo<GroupMember>();
    contributionsRepo = new FakeRepo<Contribution>();
    payoutsRepo = new FakeRepo<Payout>();
    (contributionsRepo as any).createQueryBuilder = () =>
      new FakeSumQueryBuilder(contributionsRepo.rows, 'amount');
    (payoutsRepo as any).createQueryBuilder = () => new FakeSumQueryBuilder(payoutsRepo.rows, 'amount');

    const module = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: getRepositoryToken(Group), useValue: groupsRepo },
        { provide: getRepositoryToken(GroupMember), useValue: membersRepo },
        { provide: getRepositoryToken(Contribution), useValue: contributionsRepo },
        { provide: getRepositoryToken(Payout), useValue: payoutsRepo },
      ],
    }).compile();

    service = module.get(GroupsService);
  });

  describe('tenant isolation', () => {
    it("never returns owner A's group to owner B", async () => {
      const group = await service.create(
        { name: 'Sizanani', type: 'stokvel', description: 'test', contributionAmount: 500, frequency: 'Monthly' },
        OWNER_A,
      );

      await expect(service.findOne(group.id, OWNER_B)).rejects.toBeInstanceOf(NotFoundException);
      expect(await service.findAll(OWNER_B)).toHaveLength(0);
    });
  });

  describe('balance', () => {
    it('is the sum of Paid contributions minus payouts, for that group only', async () => {
      const group = await service.create(
        { name: 'Sizanani', type: 'stokvel', description: 'test', contributionAmount: 500, frequency: 'Monthly' },
        OWNER_A,
      );
      const member = await service.addMember(group.id, { name: 'Nomvula' }, OWNER_A);

      await service.markPaid(group.id, member.id, {}, OWNER_A);
      let detail = await service.findOne(group.id, OWNER_A);
      expect(detail.balance).toBe(500);

      await service.recordPayout(group.id, { memberId: member.id, amount: 200 }, OWNER_A);
      detail = await service.findOne(group.id, OWNER_A);
      expect(detail.balance).toBe(300);
    });

    it('unmarking a payment removes it from the balance', async () => {
      const group = await service.create(
        { name: 'Sizanani', type: 'stokvel', description: 'test', contributionAmount: 500, frequency: 'Monthly' },
        OWNER_A,
      );
      const member = await service.addMember(group.id, { name: 'Nomvula' }, OWNER_A);
      await service.markPaid(group.id, member.id, {}, OWNER_A);
      await service.markUnpaid(group.id, member.id, OWNER_A);

      const detail = await service.findOne(group.id, OWNER_A);
      expect(detail.balance).toBe(0);
      expect(detail.members[0].paidThisCycle).toBe(false);
    });
  });

  describe('stokvel payout rotation', () => {
    it('assigns the first member as next-up automatically', async () => {
      const group = await service.create(
        { name: 'Sizanani', type: 'stokvel', description: 'test', contributionAmount: 500, frequency: 'Monthly' },
        OWNER_A,
      );
      const member = await service.addMember(group.id, { name: 'Nomvula' }, OWNER_A);

      const detail = await service.findOne(group.id, OWNER_A);
      expect(detail.nextPayoutMemberId).toBe(member.id);
    });

    it('advances to the next member in position order after a payout, and wraps around', async () => {
      const group = await service.create(
        { name: 'Sizanani', type: 'stokvel', description: 'test', contributionAmount: 500, frequency: 'Monthly' },
        OWNER_A,
      );
      const m1 = await service.addMember(group.id, { name: 'Nomvula' }, OWNER_A);
      const m2 = await service.addMember(group.id, { name: 'Thabo' }, OWNER_A);
      const m3 = await service.addMember(group.id, { name: 'Precious' }, OWNER_A);

      let detail = await service.findOne(group.id, OWNER_A);
      expect(detail.nextPayoutMemberId).toBe(m1.id);

      await service.recordPayout(group.id, { memberId: m1.id, amount: 500 }, OWNER_A);
      detail = await service.findOne(group.id, OWNER_A);
      expect(detail.nextPayoutMemberId).toBe(m2.id);

      await service.recordPayout(group.id, { memberId: m2.id, amount: 500 }, OWNER_A);
      await service.recordPayout(group.id, { memberId: m3.id, amount: 500 }, OWNER_A);
      detail = await service.findOne(group.id, OWNER_A);
      expect(detail.nextPayoutMemberId).toBe(m1.id); // wrapped back to the start
    });

    it('does not assign a payout position for a burial society', async () => {
      const group = await service.create(
        {
          name: 'Thuthukani',
          type: 'burial',
          description: 'test',
          contributionAmount: 100,
          frequency: 'Monthly',
          payoutAmount: 15000,
        },
        OWNER_A,
      );
      const member = await service.addMember(group.id, { name: 'Elizabeth' }, OWNER_A);
      expect(member.payoutPosition).toBeNull();

      const detail = await service.findOne(group.id, OWNER_A);
      expect(detail.nextPayoutMemberId).toBeNull();
    });
  });

  describe('markPaid', () => {
    it('rejects recording a contribution for an inactive member', async () => {
      const group = await service.create(
        { name: 'Sizanani', type: 'stokvel', description: 'test', contributionAmount: 500, frequency: 'Monthly' },
        OWNER_A,
      );
      const member = await service.addMember(group.id, { name: 'Nomvula' }, OWNER_A);
      await service.updateMember(group.id, member.id, { active: false }, OWNER_A);

      await expect(service.markPaid(group.id, member.id, {}, OWNER_A)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('marking paid twice for the same cycle updates the row rather than duplicating it', async () => {
      const group = await service.create(
        { name: 'Sizanani', type: 'stokvel', description: 'test', contributionAmount: 500, frequency: 'Monthly' },
        OWNER_A,
      );
      const member = await service.addMember(group.id, { name: 'Nomvula' }, OWNER_A);

      await service.markPaid(group.id, member.id, {}, OWNER_A);
      await service.markPaid(group.id, member.id, {}, OWNER_A);

      const cycle = currentCycleLabel('Monthly');
      const rows = contributionsRepo.rows.filter((r) => r.memberId === member.id && r.cyclePeriod === cycle);
      expect(rows).toHaveLength(1);
    });
  });
});
