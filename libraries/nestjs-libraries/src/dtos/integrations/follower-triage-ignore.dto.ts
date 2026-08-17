import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class IgnoreFollowerTriageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  externalId!: string;

  @IsString()
  @IsIn(['hot_lead', 'mutual', 'over_invested', 'quiet'])
  triage!: 'hot_lead' | 'mutual' | 'over_invested' | 'quiet';
}
