import { IsDefined, IsOptional, IsString } from 'class-validator';

export type ContextDocumentMetadataDto = {
  id: string;
  organizationId: string;
  name: string;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
  isLarge: boolean;
  warning?: string;
  skill?: {
    slug: string;
    command: string;
    conflict: boolean;
  };
};

export type ContextDocumentContentDto = {
  id: string;
  name: string;
  content: string;
  fileSize: number;
  updatedAt: Date;
  isLarge: boolean;
  warning?: string;
};

export type ContextDocumentUploadResponseDto = ContextDocumentMetadataDto;

export type SkillMetadataDto = {
  slug: string;
  command: string;
  id: string;
  name: string;
  fileSize: number;
  updatedAt: Date;
  isLarge: boolean;
  warning?: string;
};

export type SkillContentDto = SkillMetadataDto & {
  content: string;
};

export class CreateContextDocumentDto {
  @IsString()
  @IsDefined()
  name: string;

  @IsOptional()
  @IsString()
  content?: string;
}

export class UpdateContextDocumentContentDto {
  @IsString()
  @IsDefined()
  content: string;
}

export class RenameContextDocumentDto {
  @IsString()
  @IsDefined()
  name: string;
}
