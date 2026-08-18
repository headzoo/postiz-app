import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { normalizeFollowerSearch } from '@gitroom/nestjs-libraries/integrations/social/follower.sorts';

@ValidatorConstraint({ name: 'exclusiveFollowerMemberIdentity', async: false })
class ExclusiveFollowerMemberIdentityConstraint
  implements ValidatorConstraintInterface
{
  validate(_: unknown, args: ValidationArguments) {
    const object = args.object as FollowerMemberQueryDto;
    return [object.externalId, object.username].filter(Boolean).length === 1;
  }

  defaultMessage() {
    return 'Provide either externalId or username';
  }
}

export class FollowerMemberQueryDto {
  @Validate(ExclusiveFollowerMemberIdentityConstraint)
  identity = true;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  externalId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeFollowerSearch(value) : value
  )
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  username?: string;
}
