import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Money actually paid out of the group's pot — a stokvel's monthly
 * rotation payout, or a burial society's claim payout. */
@Entity('payouts')
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  groupId: string;

  @Column('uuid')
  memberId: string;

  @Column('int')
  amount: number;

  @Column('varchar')
  date: string; // ISO date

  @Column('varchar', { nullable: true })
  cyclePeriod: string | null;

  @Column('text', { nullable: true })
  note: string | null;
}
