import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { AutopostService } from '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.service';
import { PipelineAutopostDto } from '@gitroom/nestjs-libraries/dtos/autopost/autopost.dto';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';

@ApiTags('Pipelines')
@Controller('/pipelines/:pipelineId/autoposts')
export class PipelineAutopostController {
  constructor(private _autopostService: AutopostService) {}

  @Get('/')
  getAutoposts(
    @GetOrgFromRequest() org: Organization,
    @Param('pipelineId') pipelineId: string
  ) {
    return this._autopostService.getPipelineAutoposts(org.id, pipelineId);
  }

  @Post('/')
  @CheckPolicies([AuthorizationActions.Create, Sections.WEBHOOKS])
  createAutopost(
    @GetOrgFromRequest() org: Organization,
    @Param('pipelineId') pipelineId: string,
    @Body() body: PipelineAutopostDto
  ) {
    return this._autopostService.createPipelineAutopost(
      org.id,
      pipelineId,
      body
    );
  }

  @Put('/:id')
  updateAutopost(
    @GetOrgFromRequest() org: Organization,
    @Param('pipelineId') pipelineId: string,
    @Param('id') id: string,
    @Body() body: PipelineAutopostDto
  ) {
    return this._autopostService.updatePipelineAutopost(
      org.id,
      pipelineId,
      id,
      body
    );
  }

  @Delete('/:id')
  deleteAutopost(
    @GetOrgFromRequest() org: Organization,
    @Param('pipelineId') pipelineId: string,
    @Param('id') id: string
  ) {
    return this._autopostService.deletePipelineAutopost(org.id, pipelineId, id);
  }

  @Post('/:id/active')
  changeActive(
    @GetOrgFromRequest() org: Organization,
    @Param('pipelineId') pipelineId: string,
    @Param('id') id: string,
    @Body('active') active: boolean
  ) {
    return this._autopostService.changePipelineAutopostActive(
      org.id,
      pipelineId,
      id,
      active
    );
  }
}
