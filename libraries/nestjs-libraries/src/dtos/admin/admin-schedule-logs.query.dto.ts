import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ADMIN_SCHEDULE_LOG_SLUGS } from '@gitroom/nestjs-libraries/database/prisma/admin-schedule-logs/admin-schedule-log.slugs';

export class AdminScheduleLogsQueryDto {
  @IsIn([...ADMIN_SCHEDULE_LOG_SLUGS])
  key!: (typeof ADMIN_SCHEDULE_LOG_SLUGS)[number];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 100;
}
