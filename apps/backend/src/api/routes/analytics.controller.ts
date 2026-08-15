import { Controller, Get, Param, Query } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { ApiTags } from '@nestjs/swagger';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { DashboardAnalyticsDto } from '@gitroom/nestjs-libraries/dtos/analytics/dashboard.analytics.dto';
import { PlatformAnalyticsDto } from '@gitroom/nestjs-libraries/dtos/analytics/platform.analytics.dto';
import { ChannelAnalyticsService } from '@gitroom/nestjs-libraries/database/prisma/channel-analytics/channel-analytics.service';

@ApiTags('Analytics')
@Controller('/analytics')
export class AnalyticsController {
  constructor(
    private _integrationService: IntegrationService,
    private _postsService: PostsService,
    private _channelAnalyticsService: ChannelAnalyticsService
  ) { }

  @Get('/dashboard')
  async getDashboard(
    @GetOrgFromRequest() org: Organization,
    @Query() query: DashboardAnalyticsDto
  ) {
    return this._integrationService.getDashboardAnalytics(
      org,
      query.date,
      query.integrationId
    );
  }

  @Get('/post/:postId')
  async getPostAnalytics(
    @GetOrgFromRequest() org: Organization,
    @Param('postId') postId: string,
    @Query('date') date: string
  ) {
    return this._postsService.checkPostAnalytics(org.id, postId, +date);
  }

  @Get('/:integration')
  async getIntegration(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Query() query: PlatformAnalyticsDto
  ) {
    return this._channelAnalyticsService.getStoredAnalytics(
      org.id,
      integration,
      query.date
    );
  }
}
