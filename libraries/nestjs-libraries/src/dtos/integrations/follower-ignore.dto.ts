import { IsString, MaxLength, MinLength } from 'class-validator';

export class IgnoreFollowerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  externalId!: string;
}
