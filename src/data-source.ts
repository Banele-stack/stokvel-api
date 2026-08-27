import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './auth/entities/user.entity';
import { Group } from './groups/entities/group.entity';
import { GroupMember } from './groups/entities/group-member.entity';
import { Contribution } from './groups/entities/contribution.entity';
import { Payout } from './groups/entities/payout.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, Group, GroupMember, Contribution, Payout],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
