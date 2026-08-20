import type { ScheduleSpec } from '@temporalio/client';

const HOUR_MS = 60 * 60 * 1000;

export const FOLLOWER_BOT_SCORE_SCHEDULE_ID =
  'channel-follower-bot-score-schedule-v1';
export const FOLLOWER_BOT_SCORE_WORKFLOW_TYPE =
  'channelFollowerBotScoreWorkflowV1';
export const FOLLOWER_BOT_SCORE_WORKFLOW_ID =
  'channel-follower-bot-score-workflow-v1';

export const FOLLOWER_BOT_SCORE_SCHEDULE_INTERVAL_HOURS = 6;

export function toFollowerBotScoreScheduleSpec(): ScheduleSpec {
  return {
    intervals: [
      {
        every: FOLLOWER_BOT_SCORE_SCHEDULE_INTERVAL_HOURS * HOUR_MS,
      },
    ],
  };
}
