import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MarkContributionDto } from './dto/mark-contribution.dto';
import { RecordPayoutDto } from './dto/record-payout.dto';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.findAll(user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.findOne(id, user.userId);
  }

  @Post()
  create(@Body() dto: CreateGroupDto, @CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.create(dto, user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto, @CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.remove(id, user.userId);
  }

  // ---- Members ----

  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @Body() dto: CreateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.groupsService.addMember(id, dto, user.userId);
  }

  @Patch(':id/members/:memberId')
  updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.groupsService.updateMember(id, memberId, dto, user.userId);
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.groupsService.removeMember(id, memberId, user.userId);
  }

  // ---- Contributions ----

  @Post(':id/members/:memberId/pay')
  markPaid(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: MarkContributionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.groupsService.markPaid(id, memberId, dto, user.userId);
  }

  @Post(':id/members/:memberId/unpay')
  markUnpaid(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: { cyclePeriod?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.groupsService.markUnpaid(id, memberId, user.userId, body?.cyclePeriod);
  }

  // ---- Payouts ----

  @Get(':id/payouts')
  listPayouts(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.listPayouts(id, user.userId);
  }

  @Post(':id/payouts')
  recordPayout(
    @Param('id') id: string,
    @Body() dto: RecordPayoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.groupsService.recordPayout(id, dto, user.userId);
  }
}
