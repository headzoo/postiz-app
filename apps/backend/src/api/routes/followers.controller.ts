import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization, User } from '@prisma/client';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { FollowerMemberQueryDto } from '@gitroom/nestjs-libraries/dtos/integrations/follower-member.query.dto';
import { UpdateFollowerGradeDto } from '@gitroom/nestjs-libraries/dtos/integrations/follower-grade.dto';
import {
  CreateFollowerNoteDto,
  UpdateFollowerNoteDto,
} from '@gitroom/nestjs-libraries/dtos/integrations/follower-note.dto';
import { FollowersQueryDto } from '@gitroom/nestjs-libraries/dtos/integrations/followers.query.dto';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';

@ApiTags('Followers')
@Controller('/followers')
export class FollowersController {
  constructor(private _integrationService: IntegrationService) { }

  @Get('/channels')
  getChannels(@GetOrgFromRequest() org: Organization) {
    return this._integrationService.getFollowerChannels(org);
  }

  @Get('/:integrationId/member')
  getFollowerMember(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Param('integrationId') integrationId: string,
    @Query() query: FollowerMemberQueryDto
  ) {
    return this._integrationService.getFollowerMemberDetails(
      org,
      user,
      integrationId,
      query.externalId
    );
  }

  @Put('/:integrationId/member/my-grade')
  updateFollowerMemberGrade(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Param('integrationId') integrationId: string,
    @Body() body: UpdateFollowerGradeDto
  ) {
    return this._integrationService.updateFollowerMemberGrade(
      org,
      user,
      integrationId,
      body.externalId,
      body.grade
    );
  }

  @Post('/:integrationId/member/notes')
  createFollowerMemberNote(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Param('integrationId') integrationId: string,
    @Body() body: CreateFollowerNoteDto
  ) {
    return this._integrationService.createFollowerMemberNote(
      org,
      user,
      integrationId,
      body.externalId,
      body.content
    );
  }

  @Put('/:integrationId/member/notes/:noteId')
  updateFollowerMemberNote(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('noteId') noteId: string,
    @Body() body: UpdateFollowerNoteDto
  ) {
    return this._integrationService.updateFollowerMemberNote(
      org,
      integrationId,
      noteId,
      body.content
    );
  }

  @Delete('/:integrationId/member/notes/:noteId')
  deleteFollowerMemberNote(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('noteId') noteId: string
  ) {
    return this._integrationService.deleteFollowerMemberNote(
      org,
      integrationId,
      noteId
    );
  }

  @Get('/:integrationId')
  getFollowers(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Param('integrationId') integrationId: string,
    @Query() query: FollowersQueryDto
  ) {
    return this._integrationService.getFollowers(org, user, integrationId, query);
  }
}
