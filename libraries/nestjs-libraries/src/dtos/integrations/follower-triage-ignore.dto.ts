import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class IgnoreFollowerTriageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  externalId!: string;

  @IsString()
  @IsIn([
    'hot_lead',
    'mutual',
    'over_invested',
    'quiet',
    'lead',
    'engaged_not_yet',
  ])
  triage!:
    | 'hot_lead'
    | 'mutual'
    | 'over_invested'
    | 'quiet'
    | 'lead'
    | 'engaged_not_yet';
}
