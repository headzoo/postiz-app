export type ContextDocumentMetadataDto = {
  id: string;
  organizationId: string;
  name: string;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
  isLarge: boolean;
  warning?: string;
};

export type ContextDocumentUploadResponseDto = ContextDocumentMetadataDto;
