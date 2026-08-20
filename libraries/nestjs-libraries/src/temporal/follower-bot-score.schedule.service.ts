import { Injectable, Logger } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';
import { ScheduleOverlapPolicy } from '@temporalio/client';
import {
  FOLLOWER_BOT_SCORE_SCHEDULE_ID,
  FOLLOWER_BOT_SCORE_WORKFLOW_ID,
  FOLLOWER_BOT_SCORE_WORKFLOW_TYPE,
  toFollowerBotScoreScheduleSpec,
} from './follower-bot-score.schedule';

@Injectable()
export class FollowerBotScoreScheduleService {
  private readonly _logger = new Logger(FollowerBotScoreScheduleService.name);

  constructor(private _temporalService: TemporalService) { }

  async install() {
    try {
      await this.getHandle().describe();
    } catch (error) {
      if (!this.isMissing(error)) {
        throw error;
      }
      await this.create();
    }
  }

  private async create() {
    try {
      await this.scheduleClient().create({
        scheduleId: FOLLOWER_BOT_SCORE_SCHEDULE_ID,
        spec: toFollowerBotScoreScheduleSpec(),
        action: {
          type: 'startWorkflow',
          workflowType: FOLLOWER_BOT_SCORE_WORKFLOW_TYPE,
          taskQueue: 'main',
          workflowId: FOLLOWER_BOT_SCORE_WORKFLOW_ID,
          args: [{}],
        },
        policies: {
          overlap: ScheduleOverlapPolicy.SKIP,
        },
      });
    } catch (error) {
      if (!this.isAlreadyRunning(error)) {
        this._logger.error('Failed to create follower bot score schedule', error);
        throw error;
      }
    }
  }

  private getHandle() {
    return this.scheduleClient().getHandle(FOLLOWER_BOT_SCORE_SCHEDULE_ID);
  }

  private scheduleClient() {
    const client = this._temporalService.client?.getRawClient()?.schedule;
    if (!client) {
      throw new Error(
        'Temporal schedule client unavailable during bot score schedule install'
      );
    }
    return client;
  }

  private isMissing(error: unknown) {
    const value = error as { name?: string; message?: string };
    const message = value?.message?.toLowerCase() || '';
    return (
      value?.name === 'ScheduleNotFoundError' ||
      message.includes('not found') ||
      message.includes('no rows')
    );
  }

  private isAlreadyRunning(error: unknown) {
    const value = error as { name?: string; message?: string };
    const message = value?.message?.toLowerCase() || '';
    return (
      value?.name === 'ScheduleAlreadyRunning' ||
      message.includes('already exists') ||
      message.includes('already running')
    );
  }
}
