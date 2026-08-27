import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { Contribution } from './entities/contribution.entity';
import { Payout } from './entities/payout.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Group, GroupMember, Contribution, Payout])],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
