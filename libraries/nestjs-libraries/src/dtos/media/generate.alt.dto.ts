import { IsDefined, IsString } from 'class-validator';

export class GenerateAltDto {
  @IsString()
  @IsDefined()
  id: string;
}
