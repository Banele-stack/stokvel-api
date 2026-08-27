import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type GroupType = 'stokvel' | 'burial';
export type ContributionFrequency = 'Monthly' | 'Weekly';

/**
 * A stokvel or burial society. Belongs directly to the User who runs it
 * (the treasurer) — there's no separate "organization" tenant layer here
 * the way CompliancePro/POPIAGuard have one, because the realistic unit
 * for this app is one person managing their own groups, not a business
 * managing clients.
 */
@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  ownerId: string;

  @Column('varchar')
  name: string;

  @Column('varchar')
  type: GroupType;

  @Column('text')
  description: string;

  @Column('int')
  contributionAmount: number;

  @Column('varchar')
  frequency: ContributionFrequency;

  /** Stokvels only — the payoutPosition (see GroupMember) whose turn is
   * next. Advances every time a payout is recorded (see PayoutsService). */
  @Column('int', { nullable: true })
  nextPayoutPosition: number | null;

  /** Burial societies only — the fixed amount paid to a member's family on claim. */
  @Column('int', { nullable: true })
  payoutAmount: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
