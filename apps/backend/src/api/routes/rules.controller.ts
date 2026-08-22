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
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { PostRulesService } from '@gitroom/nestjs-libraries/database/prisma/rules/post-rules.service';
import {
  CreatePostRuleDto,
  PostRuleActivationDto,
  ReplacePostRuleAssignmentsDto,
  UpdatePostRuleDto,
} from '@gitroom/nestjs-libraries/dtos/rules/rule.dto';

@ApiTags('Rules')
@Controller('/rules')
export class RulesController {
  constructor(private _postRulesService: PostRulesService) {}

  @Get('/capabilities')
  getCapabilities() {
    return this._postRulesService.getCapabilities();
  }

  @Get('/')
  listRules(@GetOrgFromRequest() org: Organization) {
    return this._postRulesService.list(org.id);
  }

  @Get('/:id')
  getRule(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._postRulesService.getById(org.id, id);
  }

  @Post('/')
  createRule(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreatePostRuleDto
  ) {
    return this._postRulesService.create(org.id, body);
  }

  @Put('/:id')
  updateRule(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdatePostRuleDto
  ) {
    return this._postRulesService.update(org.id, id, body);
  }

  @Delete('/:id')
  deleteRule(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._postRulesService.delete(org.id, id);
  }

  @Put('/:id/activation')
  setRuleActivation(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: PostRuleActivationDto
  ) {
    return this._postRulesService.setEnabled(org.id, id, body);
  }

  @Put('/:id/assignments')
  replaceAssignments(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: ReplacePostRuleAssignmentsDto
  ) {
    return this._postRulesService.replaceAssignments(org.id, id, body);
  }
}
