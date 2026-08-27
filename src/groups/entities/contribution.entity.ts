import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ContributionStatus = 'Paid' | 'Unpaid';

/**
 * One member's expected contribution for one cycle (e.g. "2026-08" for a
 * monthly group). A row only exists once someone has actually looked at or
 * acted on that cycle for that member — see ContributionsService, which
 * treats "no row yet" as implicitly Unpaid rather than pre-creating rows
 * for every future cycle.
 */
@Entity('contributions')
@Index(['groupId', 'memberId', 'cyclePeriod'], { unique: true })
export class Contribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  groupId: string;

  @Column('uuid')
  memberId: string;

  /** e.g. "2026-08" (monthly) or "2026-W34" (weekly). */
  @Column('varchar')
  cyclePeriod: string;

  @Column('int')
  amount: number;

  @Column('varchar')
  status: ContributionStatus;

  @Column('varchar', { nullable: true })
  paidDate: string | null; // ISO date
}
