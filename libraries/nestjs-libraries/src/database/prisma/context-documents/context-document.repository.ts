import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

const metadataSelect = {
  id: true,
  organizationId: true,
  name: true,
  fileSize: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ContextDocumentRepository {
  constructor(
    private _contextDocument: PrismaRepository<'contextDocument'>
  ) {}

  listMetadata(organizationId: string) {
    return this._contextDocument.model.contextDocument.findMany({
      where: {
        organizationId,
      },
      select: metadataSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  findById(organizationId: string, id: string) {
    return this._contextDocument.model.contextDocument.findFirst({
      where: {
        id,
        organizationId,
      },
    });
  }

  findByName(organizationId: string, name: string) {
    return this._contextDocument.model.contextDocument.findFirst({
      where: {
        organizationId,
        name,
      },
    });
  }

  upsertDocument(
    organizationId: string,
    name: string,
    content: string,
    fileSize: number
  ) {
    return this._contextDocument.model.contextDocument.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name,
        },
      },
      create: {
        organizationId,
        name,
        content,
        fileSize,
      },
      update: {
        content,
        fileSize,
      },
    });
  }

  deleteDocument(organizationId: string, id: string) {
    return this._contextDocument.model.contextDocument.delete({
      where: {
        id,
        organizationId,
      },
    });
  }

  findAttachedToPipeline(
    organizationId: string,
    pipelineId: string,
    selector: { documentId?: string; name?: string }
  ) {
    return this._contextDocument.model.contextDocument.findFirst({
      where: {
        organizationId,
        ...(selector.documentId
          ? { id: selector.documentId }
          : { name: selector.name }),
        pipelineAssignments: {
          some: {
            pipelineId,
            pipeline: {
              organizationId,
              deletedAt: null,
            },
          },
        },
      },
    });
  }
}
