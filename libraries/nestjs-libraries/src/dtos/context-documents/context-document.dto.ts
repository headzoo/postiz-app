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
