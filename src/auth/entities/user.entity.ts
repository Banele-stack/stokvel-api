import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One person, one account — no separate "organization" layer. Unlike
 * CompliancePro/POPIAGuard (B2B, sold to a consultancy managing multiple
 * clients), a stokvel is run by whoever's actually the treasurer, and
 * that's who logs in. Groups belong directly to the User who created them
 * (see Group.ownerId).
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column('varchar')
  email: string;

  /** bcrypt hash — never the plaintext password. */
  @Column('varchar')
  passwordHash: string;

  @Column('varchar')
  name: string;

  @Column('varchar', { nullable: true })
  phone: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
