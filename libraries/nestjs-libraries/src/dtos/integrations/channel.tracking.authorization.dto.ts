import { IsDefined, IsString, MaxLength } from 'class-validator';

export class ChannelTrackingAuthorizationDto {
  @IsString()
  @IsDefined()
  @MaxLength(256)
  state: string;

  @IsString()
  @IsDefined()
  @MaxLength(2048)
  code: string;
}
