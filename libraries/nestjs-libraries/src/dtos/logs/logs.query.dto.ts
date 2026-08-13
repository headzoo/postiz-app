import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class LogsQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;
}

export class WebhookLogsQueryDto extends LogsQueryDto {
  @IsOptional()
  @IsIn(['INBOUND', 'OUTBOUND'])
  direction?: 'INBOUND' | 'OUTBOUND';
}
