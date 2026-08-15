import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { LogsService } from '@gitroom/nestjs-libraries/database/prisma/logs/logs.service';
import {
  LogsQueryDto,
  WebhookLogsQueryDto,
} from '@gitroom/nestjs-libraries/dtos/logs/logs.query.dto';

@ApiTags('Logs')
@Controller('/logs')
export class LogsController {
  constructor(private _logsService: LogsService) {}

  @Get('/posts')
  listPostLogs(
    @GetOrgFromRequest() org: Organization,
    @Query() query: LogsQueryDto
  ) {
    return this._logsService.listPostLogs(org.id, query.page, query.limit);
  }

  @Get('/webhooks')
  listWebhookLogs(
    @GetOrgFromRequest() org: Organization,
    @Query() query: WebhookLogsQueryDto
  ) {
    return this._logsService.listWebhookLogs(
      org.id,
      query.page,
      query.limit,
      query.direction,
      query.search,
      query.eventType
    );
  }
}
