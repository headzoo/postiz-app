import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { ErrorsService } from '@gitroom/nestjs-libraries/database/prisma/errors/errors.service';
import { AdminStatsService } from '@gitroom/nestjs-libraries/database/prisma/admin-stats/admin-stats.service';
import { AdminUsersService } from '@gitroom/nestjs-libraries/database/prisma/admin-users/admin-users.service';
import { RelationshipGradeScheduleService } from '@gitroom/nestjs-libraries/temporal/relationship-grade.schedule.service';
import { FollowerBotScoreScheduleService } from '@gitroom/nestjs-libraries/temporal/follower-bot-score.schedule.service';
import { AdminScheduleWorkflowService } from '@gitroom/nestjs-libraries/temporal/admin-schedule.workflow.service';
import { RelationshipGradeScheduleDto } from '@gitroom/nestjs-libraries/dtos/admin/relationship-grade.schedule.dto';
import { FollowerBotScoreScheduleDto } from '@gitroom/nestjs-libraries/dtos/admin/follower-bot-score.schedule.dto';
import { RequireAdminStepUp } from '@gitroom/backend/services/auth/admin-step-up.decorator';
import dayjs from 'dayjs';

@ApiTags('Admin')
@Controller('/admin')
@RequireAdminStepUp('general')
export class AdminController {
  constructor(
    private _errorsService: ErrorsService,
    private _adminStatsService: AdminStatsService,
    private _adminUsersService: AdminUsersService,
    private _relationshipGradeScheduleService: RelationshipGradeScheduleService,
    private _followerBotScoreScheduleService: FollowerBotScoreScheduleService,
    private _adminScheduleWorkflowService: AdminScheduleWorkflowService
  ) { }

  private assertSuperAdmin(user: User) {
    if (!user?.isSuperAdmin) {
      throw new HttpException('Unauthorized', 400);
    }
  }

  @Get('/users')
  async listUsers(
    @GetUserFromRequest() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string
  ) {
    this.assertSuperAdmin(user);
    return this._adminUsersService.listUserOrganizations({
      page: page ? parseInt(page, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 20,
      search: search || undefined,
    });
  }

  @Get('/errors')
  async listErrors(
    @GetUserFromRequest() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('platform') platform?: string,
    @Query('email') email?: string,
    @Query('unknownFirst') unknownFirst?: string
  ) {
    this.assertSuperAdmin(user);
    return this._errorsService.listErrors({
      page: page ? parseInt(page, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 20,
      platform: platform || undefined,
      email: email || undefined,
      unknownFirst: unknownFirst === 'true' || unknownFirst === '1',
    });
  }

  @Get('/errors/platforms')
  async listPlatforms(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._errorsService.listPlatforms();
  }

  @Get('/stats')
  async getStats(
    @GetUserFromRequest() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('unknownOnly') unknownOnly?: string
  ) {
    this.assertSuperAdmin(user);

    const fromDate = from ? dayjs(from) : dayjs().subtract(30, 'day');
    const toDate = to ? dayjs(to) : dayjs();

    return this._adminStatsService.getStats({
      from: fromDate.startOf('day').toDate(),
      to: toDate.endOf('day').toDate(),
      unknownOnly: unknownOnly === 'true' || unknownOnly === '1',
    });
  }

  @Get('/schedule/relationship-grades')
  async getRelationshipGradeSchedule(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._relationshipGradeScheduleService.getStatus();
  }

  @Put('/schedule/relationship-grades')
  @RequireAdminStepUp('fresh')
  async updateRelationshipGradeSchedule(
    @GetUserFromRequest() user: User,
    @Body() body: RelationshipGradeScheduleDto
  ) {
    this.assertSuperAdmin(user);
    try {
      return await this._relationshipGradeScheduleService.update(body);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new HttpException(error.message, 400);
      }
      throw error;
    }
  }

  @Post('/schedule/relationship-grades/trigger')
  @RequireAdminStepUp('fresh')
  async triggerRelationshipGradeSchedule(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._relationshipGradeScheduleService.trigger();
  }

  @Get('/schedule/follower-bot-scores')
  async getFollowerBotScoreSchedule(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._followerBotScoreScheduleService.getStatus();
  }

  @Put('/schedule/follower-bot-scores')
  @RequireAdminStepUp('fresh')
  async updateFollowerBotScoreSchedule(
    @GetUserFromRequest() user: User,
    @Body() body: FollowerBotScoreScheduleDto
  ) {
    this.assertSuperAdmin(user);
    try {
      return await this._followerBotScoreScheduleService.update(body);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new HttpException(error.message, 400);
      }
      throw error;
    }
  }

  @Post('/schedule/follower-bot-scores/trigger')
  @RequireAdminStepUp('fresh')
  async triggerFollowerBotScoreSchedule(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._followerBotScoreScheduleService.trigger();
  }

  @Get('/schedule/missing-post-recovery')
  async getMissingPostRecoverySchedule(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._adminScheduleWorkflowService.getMissingPostRecoveryStatus();
  }

  @Post('/schedule/missing-post-recovery/trigger')
  @RequireAdminStepUp('fresh')
  async triggerMissingPostRecoverySchedule(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._adminScheduleWorkflowService.triggerMissingPostRecovery();
  }

  @Get('/schedule/post-workflows')
  async getPostWorkflowSchedule(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._adminScheduleWorkflowService.getPostWorkflowStatus();
  }

  @Post('/schedule/post-workflows/trigger')
  @RequireAdminStepUp('fresh')
  async triggerPostWorkflowSchedule(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._adminScheduleWorkflowService.triggerPostWorkflowTick();
  }

  @Get('/schedule/autopost-workflows')
  async getAutopostWorkflowSchedule(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._adminScheduleWorkflowService.getAutopostWorkflowStatus();
  }

  @Post('/schedule/autopost-workflows/trigger')
  @RequireAdminStepUp('fresh')
  async triggerAutopostWorkflowSchedule(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._adminScheduleWorkflowService.triggerAutopostWorkflows();
  }

  @Get('/schedule/lead-bridge')
  async getLeadBridgeSchedule(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._adminScheduleWorkflowService.getLeadBridgeStatus();
  }

  @Post('/schedule/lead-bridge/trigger')
  @RequireAdminStepUp('fresh')
  async triggerLeadBridgeSchedule(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._adminScheduleWorkflowService.triggerLeadBridge();
  }
}
