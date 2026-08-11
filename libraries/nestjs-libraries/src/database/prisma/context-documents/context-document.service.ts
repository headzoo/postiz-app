import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContextDocumentRepository } from '@gitroom/nestjs-libraries/database/prisma/context-documents/context-document.repository';
import {
  ContextDocumentContentDto,
  ContextDocumentMetadataDto,
  ContextDocumentUploadResponseDto,
} from '@gitroom/nestjs-libraries/dtos/context-documents/context-document.dto';
import {
  getContextDocumentLargeWarning,
  isContextDocumentLarge,
  validateContextDocumentUpload,
} from '@gitroom/nestjs-libraries/upload/context-document.upload.validation';
import { ContextDocument } from '@prisma/client';

@Injectable()
export class ContextDocumentService {
  constructor(
    private _contextDocumentRepository: ContextDocumentRepository
  ) {}

  async listDocuments(
    organizationId: string
  ): Promise<ContextDocumentMetadataDto[]> {
    const documents =
      await this._contextDocumentRepository.listMetadata(organizationId);

    return documents.map((document) => this.toMetadata(document));
  }

  async uploadDocument(
    organizationId: string,
    file?: Express.Multer.File
  ): Promise<ContextDocumentUploadResponseDto> {
    const validated = validateContextDocumentUpload(file);
    const document = await this._contextDocumentRepository.upsertDocument(
      organizationId,
      validated.name,
      validated.content,
      validated.fileSize
    );

    return this.toMetadata(document);
  }

  async getDocumentById(
    organizationId: string,
    id: string
  ): Promise<ContextDocumentContentDto> {
    const document = await this._contextDocumentRepository.findById(
      organizationId,
      id
    );

    if (!document) {
      throw new NotFoundException('Context document not found.');
    }

    return this.toContentResponse(document);
  }

  async getDocumentByName(organizationId: string, name: string) {
    const document = await this._contextDocumentRepository.findByName(
      organizationId,
      name
    );

    if (!document) {
      throw new NotFoundException('Context document not found.');
    }

    return this.toContentResponse(document);
  }

  async getAttachedDocumentForPipeline(
    organizationId: string,
    pipelineId: string,
    selector: { documentId?: string; name?: string }
  ) {
    const hasDocumentId = Boolean(selector.documentId);
    const hasName = Boolean(selector.name);

    if (hasDocumentId === hasName) {
      throw new BadRequestException(
        'Provide exactly one of documentId or name.'
      );
    }

    const document =
      await this._contextDocumentRepository.findAttachedToPipeline(
        organizationId,
        pipelineId,
        selector
      );

    if (!document) {
      throw new NotFoundException('Context document not found.');
    }

    return this.toContentResponse(document);
  }

  async deleteDocument(organizationId: string, id: string) {
    try {
      await this._contextDocumentRepository.deleteDocument(organizationId, id);
      return { id };
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException('Context document not found.');
      }

      throw error;
    }
  }

  private toMetadata(
    document: Pick<
      ContextDocument,
      | 'id'
      | 'organizationId'
      | 'name'
      | 'fileSize'
      | 'createdAt'
      | 'updatedAt'
    >
  ): ContextDocumentMetadataDto {
    const warning = getContextDocumentLargeWarning(document.fileSize);

    return {
      id: document.id,
      organizationId: document.organizationId,
      name: document.name,
      fileSize: document.fileSize,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      isLarge: isContextDocumentLarge(document.fileSize),
      ...(warning ? { warning } : {}),
    };
  }

  private toContentResponse(
    document: ContextDocument
  ): ContextDocumentContentDto {
    const warning = getContextDocumentLargeWarning(document.fileSize);

    return {
      id: document.id,
      name: document.name,
      content: document.content,
      fileSize: document.fileSize,
      updatedAt: document.updatedAt,
      isLarge: isContextDocumentLarge(document.fileSize),
      ...(warning ? { warning } : {}),
    };
  }
}
