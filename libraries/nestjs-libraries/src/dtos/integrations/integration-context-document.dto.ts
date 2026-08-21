import { IsArray, IsDefined, IsString } from 'class-validator';

export class UpdateIntegrationContextDocumentsDto {
  @IsArray()
  @IsDefined()
  @IsString({ each: true })
  contextDocumentIds!: string[];
}
