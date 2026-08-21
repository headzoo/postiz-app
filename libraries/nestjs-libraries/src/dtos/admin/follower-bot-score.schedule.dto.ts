import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import {
  FOLLOWER_BOT_SCORE_SCHEDULE_MAX_HOURS,
  FOLLOWER_BOT_SCORE_SCHEDULE_MIN_HOURS,
} from '@gitroom/nestjs-libraries/temporal/follower-bot-score.schedule';

export class FollowerBotScoreScheduleDto {
  @Type(() => Number)
  @IsInt()
  @Min(FOLLOWER_BOT_SCORE_SCHEDULE_MIN_HOURS)
  @Max(FOLLOWER_BOT_SCORE_SCHEDULE_MAX_HOURS)
  intervalHours!: number;
}
