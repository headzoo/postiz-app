import { IsString, MaxLength } from 'class-validator';
import { IsSafePublicHttpUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';

export interface OpenGraphResponse {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  imageAlt: string | null;
  siteName: string | null;
}

export class OpenGraphDto {
  @IsString()
  @MaxLength(2048)
  @IsSafePublicHttpUrl()
  url: string;
}
