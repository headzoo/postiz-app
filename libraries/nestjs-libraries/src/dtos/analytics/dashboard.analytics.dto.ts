import { Type } from 'class-transformer';
import { IsIn } from 'class-validator';

export class DashboardAnalyticsDto {
  @Type(() => Number)
  @IsIn([7, 30, 90])
  date: 7 | 30 | 90;
}
