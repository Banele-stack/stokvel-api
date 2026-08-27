import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A member of a group. Deliberately NOT required to have their own User
 * account/login — in real stokvels and burial societies, the treasurer is
 * usually the only one who ever touches the ledger, and members may not
 * all have smartphones or want an account. `linkedUserId` is there for
 * later (a member who *does* want to log in and see their own group), but
 * nothing requires it.
 */
@Entity('group_members')
export class GroupMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  groupId: string;

  @Column('varchar')
  name: string;

  @Column('varchar', { nullable: true })
  phone: string | null;

  @Column('uuid', { nullable: true })
  linkedUserId: string | null;

  /** Stokvels only — position in the payout rotation, 1-indexed. */
  @Column('int', { nullable: true })
  payoutPosition: number | null;

  @Column('varchar')
  joinedDate: string; // ISO date

  @Column('boolean', { default: true })
  active: boolean;
}
