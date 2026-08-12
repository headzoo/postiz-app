import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { FollowersQueryDto } from '@gitroom/nestjs-libraries/dtos/integrations/followers.query.dto';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';

@ApiTags('Followers')
@Controller('/followers')
export class FollowersController {
  constructor(private _integrationService: IntegrationService) {}

  @Get('/channels')
  getChannels(@GetOrgFromRequest() org: Organization) {
    return this._integrationService.getFollowerChannels(org);
  }

  @Get('/:integrationId')
  getFollowers(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Query() query: FollowersQueryDto
  ) {
    return this._integrationService.getFollowers(org, integrationId, query);
  }
}
