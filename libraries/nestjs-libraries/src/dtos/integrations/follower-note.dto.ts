import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateFollowerNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  externalId!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  content!: string;
}

export class UpdateFollowerNoteDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  content!: string;
}
