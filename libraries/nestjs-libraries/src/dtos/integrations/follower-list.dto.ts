import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateFollowerListDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;
}

export class UpdateFollowerListDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;
}

export class FollowerListMemberDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  externalId!: string;
}

export class ImportFollowerListMemberDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  url!: string;
}
