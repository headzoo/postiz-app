import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class DashboardAnalyticsDto {
  @Type(() => Number)
  @IsIn([7, 30, 90])
  date: 7 | 30 | 90;

  @IsOptional()
  @IsString()
  integrationId?: string;
}
