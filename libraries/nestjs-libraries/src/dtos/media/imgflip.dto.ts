import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ImgflipCaptionDto {
  @IsString()
  @MaxLength(500)
  text: string;
}

export class GenerateImgflipMemeDto {
  @IsString()
  @IsDefined()
  @MaxLength(64)
  templateId: string;

  @IsArray()
  @ArrayMaxSize(10)
  @Type(() => ImgflipCaptionDto)
  @ValidateNested({ each: true })
  captions: ImgflipCaptionDto[];
}

export class SaveImgflipMemeDto {
  @IsString()
  @IsDefined()
  @MaxLength(64)
  templateId: string;

  @IsString()
  @IsDefined()
  @MaxLength(2048)
  url: string;
}
