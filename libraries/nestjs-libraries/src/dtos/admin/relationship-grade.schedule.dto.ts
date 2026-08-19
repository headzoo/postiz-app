import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { RELATIONSHIP_GRADE_SCHEDULE_UNITS } from '@gitroom/nestjs-libraries/temporal/relationship-grade.schedule';

@ValidatorConstraint({ name: 'relationshipGradeIntervalLimit', async: false })
class RelationshipGradeIntervalLimit implements ValidatorConstraintInterface {
  validate(interval: number, args: ValidationArguments) {
    const unit = (args.object as RelationshipGradeScheduleDto).unit;
    if (unit === 'day') {
      return interval <= 30;
    }
    if (unit === 'month') {
      return interval <= 12;
    }
    return interval <= 168;
  }

  defaultMessage() {
    return 'interval is outside the allowed range for this unit';
  }
}

export class RelationshipGradeScheduleDto {
  @IsString()
  @IsIn([...RELATIONSHIP_GRADE_SCHEDULE_UNITS])
  unit!: 'hour' | 'day' | 'month';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  @Validate(RelationshipGradeIntervalLimit)
  interval!: number;

  @ValidateIf((value) => value.unit === 'day' || value.unit === 'month')
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  timeOfDay?: string;

  @ValidateIf((value) => value.unit === 'month')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @IsOptional()
  paused?: boolean;
}
