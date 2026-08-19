import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

const AUTHENTICATOR_ATTACHMENTS = ['cross-platform', 'platform'];

class AdminPasskeyAttestationResponseDto {
  @IsString()
  @IsNotEmpty()
  clientDataJSON!: string;

  @IsString()
  @IsNotEmpty()
  attestationObject!: string;

  @IsOptional()
  @IsString()
  authenticatorData?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  transports?: string[];

  @IsOptional()
  @IsInt()
  publicKeyAlgorithm?: number;

  @IsOptional()
  @IsString()
  publicKey?: string;
}

class AdminPasskeyAssertionResponseDto {
  @IsString()
  @IsNotEmpty()
  clientDataJSON!: string;

  @IsString()
  @IsNotEmpty()
  authenticatorData!: string;

  @IsString()
  @IsNotEmpty()
  signature!: string;

  @IsOptional()
  @IsString()
  userHandle?: string;
}

export class AdminPasskeyRegistrationDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  rawId!: string;

  @IsIn(['public-key'])
  type!: 'public-key';

  @IsOptional()
  @IsIn(AUTHENTICATOR_ATTACHMENTS)
  authenticatorAttachment?: string;

  @IsOptional()
  @IsObject()
  clientExtensionResults?: Record<string, unknown>;

  @IsObject()
  @ValidateNested()
  @Type(() => AdminPasskeyAttestationResponseDto)
  response!: AdminPasskeyAttestationResponseDto;
}

export class AdminPasskeyAssertionDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  rawId!: string;

  @IsIn(['public-key'])
  type!: 'public-key';

  @IsOptional()
  @IsIn(AUTHENTICATOR_ATTACHMENTS)
  authenticatorAttachment?: string;

  @IsOptional()
  @IsObject()
  clientExtensionResults?: Record<string, unknown>;

  @IsObject()
  @ValidateNested()
  @Type(() => AdminPasskeyAssertionResponseDto)
  response!: AdminPasskeyAssertionResponseDto;
}
