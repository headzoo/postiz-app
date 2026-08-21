import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { AutopostService } from '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.service';

@Injectable()
@Activity()
export class AutopostActivity {
  constructor(private _autoPostService: AutopostService) { }

  @ActivityMethod()
  async autoPost(id: string) {
    return this._autoPostService.startAutopost(id);
  }

  @ActivityMethod()
  async listActiveAutopostIdsForAdmin(
    request: { after?: string; take?: number } = {}
  ) {
    return this._autoPostService.listActiveAutopostIds(
      request.after,
      request.take ?? 50
    );
  }
}

