/**
 * Loads a demo owner account plus the same three groups the frontend's
 * earlier mock-data.ts used, so switching the UI over to the real backend
 * shows familiar content instead of an empty state.
 *
 * Run with: npm run seed
 */
import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../auth/entities/user.entity';
import { Group } from '../groups/entities/group.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { Contribution } from '../groups/entities/contribution.entity';
import { Payout } from '../groups/entities/payout.entity';
import { currentCycleLabel } from '../groups/cycle.util';

const DEMO_EMAIL = 'demo@stokvela.co.za';
const DEMO_PASSWORD = 'Stokvela2026!';
const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

interface SeedMember {
  name: string;
  paidThisCycle: boolean;
  totalContributed: number;
  joinedDate: string;
  payoutPosition?: number;
}

interface SeedGroup {
  name: string;
  type: 'stokvel' | 'burial';
  description: string;
  contributionAmount: number;
  frequency: 'Monthly' | 'Weekly';
  payoutAmount?: number;
  nextPayoutIndex?: number; // index into members[] — stokvels only
  members: SeedMember[];
}

const GROUPS: SeedGroup[] = [
  {
    name: 'Sizanani Savings Club',
    type: 'stokvel',
    description: 'Monthly rotating savings — one member takes the full pot each month, in order.',
    contributionAmount: 500,
    frequency: 'Monthly',
    nextPayoutIndex: 2,
    members: [
      { name: 'Nomvula Dlamini', paidThisCycle: true, totalContributed: 6000, joinedDate: '2024-02-01' },
      { name: 'Thabo Mokoena', paidThisCycle: true, totalContributed: 6000, joinedDate: '2024-02-01' },
      { name: 'Precious Nkosi', paidThisCycle: true, totalContributed: 5500, joinedDate: '2024-02-01' },
      { name: 'Sipho Zulu', paidThisCycle: false, totalContributed: 5500, joinedDate: '2024-03-01' },
      { name: 'Ayanda Khumalo', paidThisCycle: true, totalContributed: 5500, joinedDate: '2024-03-01' },
      { name: 'Lindiwe Mahlangu', paidThisCycle: true, totalContributed: 5000, joinedDate: '2024-04-01' },
      { name: 'Bongani Sithole', paidThisCycle: false, totalContributed: 5000, joinedDate: '2024-04-01' },
      { name: 'Zanele Cele', paidThisCycle: true, totalContributed: 4500, joinedDate: '2024-05-01' },
    ],
  },
  {
    name: 'Ladies of Mzansi Investment Group',
    type: 'stokvel',
    description: 'End-of-year grocery & investment stokvel — payout is a lump sum before December.',
    contributionAmount: 350,
    frequency: 'Monthly',
    nextPayoutIndex: 1,
    members: [
      { name: 'Ntombi Radebe', paidThisCycle: true, totalContributed: 4200, joinedDate: '2023-01-15' },
      { name: 'Palesa Moloi', paidThisCycle: true, totalContributed: 4200, joinedDate: '2023-01-15' },
      { name: 'Refilwe Tshabalala', paidThisCycle: true, totalContributed: 4200, joinedDate: '2023-01-15' },
      { name: 'Nomsa Ndlovu', paidThisCycle: true, totalContributed: 3850, joinedDate: '2023-02-01' },
      { name: 'Buhle Mthembu', paidThisCycle: false, totalContributed: 3850, joinedDate: '2023-02-01' },
      { name: 'Thandeka Gumede', paidThisCycle: true, totalContributed: 3500, joinedDate: '2023-03-01' },
    ],
  },
  {
    name: 'Thuthukani Burial Society',
    type: 'burial',
    description: "Community burial society — paid-up members' families receive a fixed payout to cover funeral costs.",
    contributionAmount: 100,
    frequency: 'Monthly',
    payoutAmount: 15000,
    members: [
      { name: 'Elizabeth Khoza', paidThisCycle: true, totalContributed: 3600, joinedDate: '2021-06-01' },
      { name: 'Jabulani Ngcobo', paidThisCycle: true, totalContributed: 3600, joinedDate: '2021-06-01' },
      { name: 'Fikile Mabaso', paidThisCycle: true, totalContributed: 3300, joinedDate: '2021-07-01' },
      { name: 'Vusi Maseko', paidThisCycle: false, totalContributed: 3300, joinedDate: '2021-07-01' },
      { name: 'Nonhlanhla Skosana', paidThisCycle: true, totalContributed: 3000, joinedDate: '2021-08-01' },
      { name: 'Mandla Buthelezi', paidThisCycle: true, totalContributed: 3000, joinedDate: '2021-08-01' },
      { name: 'Gugu Shabalala', paidThisCycle: true, totalContributed: 2700, joinedDate: '2021-09-01' },
      { name: 'Sibusiso Mnguni', paidThisCycle: true, totalContributed: 2700, joinedDate: '2021-09-01' },
      { name: 'Portia Nxumalo', paidThisCycle: false, totalContributed: 2400, joinedDate: '2021-10-01' },
      { name: 'Themba Zwane', paidThisCycle: true, totalContributed: 2400, joinedDate: '2021-10-01' },
    ],
  },
];

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [User, Group, GroupMember, Contribution, Payout],
    synchronize: false,
  });
  await dataSource.initialize();

  const usersRepo = dataSource.getRepository(User);
  const groupsRepo = dataSource.getRepository(Group);
  const membersRepo = dataSource.getRepository(GroupMember);
  const contributionsRepo = dataSource.getRepository(Contribution);
  const payoutsRepo = dataSource.getRepository(Payout);

  // --- Clear this demo user's data (idempotent re-seed) ---------------------
  const existingGroups = await groupsRepo.find({ where: { ownerId: DEMO_USER_ID } });
  for (const g of existingGroups) {
    const members = await membersRepo.find({ where: { groupId: g.id } });
    for (const m of members) {
      await contributionsRepo.delete({ groupId: g.id, memberId: m.id });
      await payoutsRepo.delete({ groupId: g.id, memberId: m.id });
    }
    await membersRepo.delete({ groupId: g.id });
  }
  await groupsRepo.delete({ ownerId: DEMO_USER_ID });
  await usersRepo.delete({ id: DEMO_USER_ID });

  // --- Demo user --------------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  await usersRepo.save(
    usersRepo.create({
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      passwordHash,
      name: 'Thabo Mokoena',
      phone: '072 345 6789',
    }),
  );

  // --- Groups, members, and enough contribution history to back up the
  // seeded totals + "paid this cycle" state ------------------------------------
  for (const seedGroup of GROUPS) {
    const group = await groupsRepo.save(
      groupsRepo.create({
        ownerId: DEMO_USER_ID,
        name: seedGroup.name,
        type: seedGroup.type,
        description: seedGroup.description,
        contributionAmount: seedGroup.contributionAmount,
        frequency: seedGroup.frequency,
        payoutAmount: seedGroup.payoutAmount ?? null,
        nextPayoutPosition: null,
      }),
    );

    const cycle = currentCycleLabel(seedGroup.frequency);
    const savedMembers: GroupMember[] = [];

    for (const [index, seedMember] of seedGroup.members.entries()) {
      const member = await membersRepo.save(
        membersRepo.create({
          groupId: group.id,
          name: seedMember.name,
          phone: null,
          joinedDate: seedMember.joinedDate,
          payoutPosition: seedGroup.type === 'stokvel' ? index + 1 : null,
          active: true,
        }),
      );
      savedMembers.push(member);

      // One lump "history" row covers everything before this cycle, then a
      // real current-cycle row if they've actually paid this cycle — so
      // totalContributed and paidThisCycle both come out matching the seed.
      const currentCycleAmount = seedMember.paidThisCycle ? seedGroup.contributionAmount : 0;
      const historyAmount = seedMember.totalContributed - currentCycleAmount;
      if (historyAmount > 0) {
        await contributionsRepo.save(
          contributionsRepo.create({
            groupId: group.id,
            memberId: member.id,
            cyclePeriod: 'history',
            amount: historyAmount,
            status: 'Paid',
            paidDate: null,
          }),
        );
      }
      if (seedMember.paidThisCycle) {
        await contributionsRepo.save(
          contributionsRepo.create({
            groupId: group.id,
            memberId: member.id,
            cyclePeriod: cycle,
            amount: seedGroup.contributionAmount,
            status: 'Paid',
            paidDate: new Date().toISOString().slice(0, 10),
          }),
        );
      }
    }

    if (seedGroup.type === 'stokvel' && seedGroup.nextPayoutIndex != null) {
      group.nextPayoutPosition = savedMembers[seedGroup.nextPayoutIndex].payoutPosition;
      await groupsRepo.save(group);
    }
  }

  await dataSource.destroy();

  console.log('Seed complete.');
  console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
