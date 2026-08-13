import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { normalizeFollowerSearch } from '@gitroom/nestjs-libraries/integrations/social/follower.sorts';

export class FollowersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 24;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cursor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  direction?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(['week', 'month', '90_day', 'year'])
  window?: 'week' | 'month' | '90_day' | 'year';

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeFollowerSearch(value) : value
  )
  @IsString()
  @MaxLength(64)
  search?: string;
}
