import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class DashboardAnalyticsPreferenceItemDto {
  @IsString()
  @IsDefined()
  @MinLength(1)
  @MaxLength(128)
  integrationId: string;

  @IsString()
  @IsDefined()
  @MinLength(1)
  @MaxLength(256)
  metricKey: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  position: number;

  @IsBoolean()
  hidden: boolean;
}

export class SaveDashboardAnalyticsPreferencesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => DashboardAnalyticsPreferenceItemDto)
  preferences: DashboardAnalyticsPreferenceItemDto[];
}

export class GetDashboardAnalyticsPreferencesQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  integrationId?: string;
}
