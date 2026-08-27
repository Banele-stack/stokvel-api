import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1787485221712 implements MigrationInterface {
    name = 'InitialSchema1787485221712'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "name" character varying NOT NULL, "phone" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "name" character varying NOT NULL, "type" character varying NOT NULL, "description" text NOT NULL, "contributionAmount" integer NOT NULL, "frequency" character varying NOT NULL, "nextPayoutPosition" integer, "payoutAmount" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_659d1483316afb28afd3a90646e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4d8d8897aef1c049336d8dde13" ON "groups" ("ownerId") `);
        await queryRunner.query(`CREATE TABLE "group_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "groupId" uuid NOT NULL, "name" character varying NOT NULL, "phone" character varying, "linkedUserId" uuid, "payoutPosition" integer, "joinedDate" character varying NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_86446139b2c96bfd0f3b8638852" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1aa8d31831c3126947e7a713c2" ON "group_members" ("groupId") `);
        await queryRunner.query(`CREATE TABLE "contributions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "groupId" uuid NOT NULL, "memberId" uuid NOT NULL, "cyclePeriod" character varying NOT NULL, "amount" integer NOT NULL, "status" character varying NOT NULL, "paidDate" character varying, CONSTRAINT "PK_ca2b4f39eb9e32a61278c711f79" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_00dcd076e527ab82419e2382ca" ON "contributions" ("groupId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_914ebb564d3b5a90dca6c75d94" ON "contributions" ("groupId", "memberId", "cyclePeriod") `);
        await queryRunner.query(`CREATE TABLE "payouts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "groupId" uuid NOT NULL, "memberId" uuid NOT NULL, "amount" integer NOT NULL, "date" character varying NOT NULL, "cyclePeriod" character varying, "note" text, CONSTRAINT "PK_76855dc4f0a6c18c72eea302e87" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dd8c9ae3c3fcb838e2fdca0a63" ON "payouts" ("groupId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_dd8c9ae3c3fcb838e2fdca0a63"`);
        await queryRunner.query(`DROP TABLE "payouts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_914ebb564d3b5a90dca6c75d94"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_00dcd076e527ab82419e2382ca"`);
        await queryRunner.query(`DROP TABLE "contributions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1aa8d31831c3126947e7a713c2"`);
        await queryRunner.query(`DROP TABLE "group_members"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d8d8897aef1c049336d8dde13"`);
        await queryRunner.query(`DROP TABLE "groups"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
