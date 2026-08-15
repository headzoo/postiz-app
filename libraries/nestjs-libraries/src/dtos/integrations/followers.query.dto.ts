import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { normalizeFollowerSearch } from '@gitroom/nestjs-libraries/integrations/social/follower.sorts';

@ValidatorConstraint({ name: 'exclusiveAudienceTriage', async: false })
class ExclusiveAudienceTriageConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const object = args.object as FollowersQueryDto;
    const selected = [object.audience, object.triage, object.listId].filter(
      Boolean
    );
    return selected.length <= 1;
  }

  defaultMessage() {
    return 'audience, triage, and listId cannot be combined';
  }
}

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

  @IsOptional()
  @IsIn(['hot_lead', 'mutual', 'over_invested', 'quiet', 'engaged_not_yet'])
  @Validate(ExclusiveAudienceTriageConstraint)
  triage?: 'hot_lead' | 'mutual' | 'over_invested' | 'quiet' | 'engaged_not_yet';

  @IsOptional()
  @IsIn(['lead'])
  @Validate(ExclusiveAudienceTriageConstraint)
  audience?: 'lead';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Validate(ExclusiveAudienceTriageConstraint)
  listId?: string;
}
