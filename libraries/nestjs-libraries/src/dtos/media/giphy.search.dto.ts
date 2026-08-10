import { Type } from 'class-transformer';
import { IsDefined, IsNumber, IsOptional, IsString } from 'class-validator';

export class GiphySearchDto {
  @IsString()
  @IsDefined()
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

export class GiphyTrendingDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
