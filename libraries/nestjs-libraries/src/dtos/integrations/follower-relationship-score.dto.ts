import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshFollowerRelationshipScoreDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  externalId!: string;

  @IsString()
  @IsIn(['their', 'your'])
  direction!: 'their' | 'your';
}
