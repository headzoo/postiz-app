import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContextDocumentRepository } from './context-document.repository';
import { ContextDocumentService } from './context-document.service';
import {
  CONTEXT_DOCUMENT_LARGE_WARNING_BYTES,
  CONTEXT_DOCUMENT_MAX_BYTES,
  decodeUtf8Fatal,
  normalizeContextDocumentName,
  validateContextDocumentUpload,
} from '@gitroom/nestjs-libraries/upload/context-document.upload.validation';

describe('ContextDocumentService', () => {
  const organizationId = 'org-1';
  const otherOrganizationId = 'org-2';

  const createRepository = () => ({
    listMetadata: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    upsertDocument: jest.fn(),
    deleteDocument: jest.fn(),
  });

  const createService = (repository = createRepository()) => ({
    repository,
    service: new ContextDocumentService(
      repository as unknown as ContextDocumentRepository
    ),
  });

  const sampleDocument = {
    id: 'doc-1',
    organizationId,
    name: 'BRANDING.md',
    content: '# Branding\n\nUse this voice.',
    fileSize: 28,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('upserts a document and replaces same-name uploads on the stable row', async () => {
    const { repository, service } = createService();
    const firstContent = '# Branding\n\nUse this voice.';
    const secondContent = '# Updated branding';
    repository.upsertDocument
      .mockResolvedValueOnce(sampleDocument)
      .mockResolvedValueOnce({
        ...sampleDocument,
        content: secondContent,
        fileSize: Buffer.byteLength(secondContent, 'utf8'),
        updatedAt: new Date('2026-01-03T00:00:00.000Z'),
      });

    const firstUpload = await service.uploadDocument(organizationId, {
      originalname: 'folder/BRANDING.md',
      buffer: Buffer.from(firstContent, 'utf8'),
      size: Buffer.byteLength(firstContent, 'utf8'),
    } as Express.Multer.File);
    const secondUpload = await service.uploadDocument(organizationId, {
      originalname: 'BRANDING.md',
      buffer: Buffer.from(secondContent, 'utf8'),
      size: Buffer.byteLength(secondContent, 'utf8'),
    } as Express.Multer.File);

    expect(repository.upsertDocument).toHaveBeenNthCalledWith(
      1,
      organizationId,
      'BRANDING.md',
      firstContent,
      Buffer.byteLength(firstContent, 'utf8')
    );
    expect(repository.upsertDocument).toHaveBeenNthCalledWith(
      2,
      organizationId,
      'BRANDING.md',
      secondContent,
      Buffer.byteLength(secondContent, 'utf8')
    );
    expect(firstUpload.id).toBe('doc-1');
    expect(secondUpload.id).toBe('doc-1');
    expect(firstUpload).not.toHaveProperty('content');
    expect(secondUpload).not.toHaveProperty('content');
  });

  it('lists metadata without content', async () => {
    const { repository, service } = createService();
    repository.listMetadata.mockResolvedValue([
      {
        id: sampleDocument.id,
        organizationId,
        name: sampleDocument.name,
        fileSize: sampleDocument.fileSize,
        createdAt: sampleDocument.createdAt,
        updatedAt: sampleDocument.updatedAt,
      },
    ]);

    const documents = await service.listDocuments(organizationId);

    expect(documents).toEqual([
      {
        id: 'doc-1',
        organizationId,
        name: 'BRANDING.md',
        fileSize: 28,
        createdAt: sampleDocument.createdAt,
        updatedAt: sampleDocument.updatedAt,
        isLarge: false,
      },
    ]);
    expect(documents[0]).not.toHaveProperty('content');
  });

  it('flags large documents at or above the warning threshold', async () => {
    const largeContent = 'x'.repeat(CONTEXT_DOCUMENT_LARGE_WARNING_BYTES);
    const { repository, service } = createService();
    repository.upsertDocument.mockResolvedValue({
      ...sampleDocument,
      fileSize: largeContent.length,
    });

    const upload = await service.uploadDocument(organizationId, {
      originalname: 'LARGE.md',
      buffer: Buffer.from(largeContent, 'utf8'),
      size: largeContent.length,
    } as Express.Multer.File);

    expect(upload.isLarge).toBe(true);
    expect(upload.warning).toContain(`${largeContent.length} bytes`);
  });

  it('rejects uploads above the hard size limit', () => {
    expect(() =>
      validateContextDocumentUpload({
        originalname: 'TOO-LARGE.md',
        buffer: Buffer.alloc(CONTEXT_DOCUMENT_MAX_BYTES + 1, 1),
        size: CONTEXT_DOCUMENT_MAX_BYTES + 1,
      } as Express.Multer.File)
    ).toThrow(BadRequestException);
  });

  it('rejects invalid extensions, empty content, NUL bytes, and invalid UTF-8', () => {
    expect(() =>
      validateContextDocumentUpload({
        originalname: 'notes.txt',
        buffer: Buffer.from('hello'),
        size: 5,
      } as Express.Multer.File)
    ).toThrow('Only .md and .markdown files are supported.');

    expect(() =>
      validateContextDocumentUpload({
        originalname: 'EMPTY.md',
        buffer: Buffer.from('   \n\t  '),
        size: 6,
      } as Express.Multer.File)
    ).toThrow('The uploaded file is empty.');

    expect(() =>
      validateContextDocumentUpload({
        originalname: 'NUL.md',
        buffer: Buffer.from('hello\0world'),
        size: 11,
      } as Express.Multer.File)
    ).toThrow('invalid null bytes');

    expect(() => decodeUtf8Fatal(Buffer.from([0xff, 0xfe, 0xfd]))).toThrow(
      'valid UTF-8'
    );
  });

  it('normalizes path components from filenames', () => {
    expect(normalizeContextDocumentName('nested/path/BRANDING.markdown')).toBe(
      'BRANDING.markdown'
    );
  });

  it('enforces organization ownership on reads and deletes', async () => {
    const { repository, service } = createService();
    repository.findById.mockResolvedValue(null);
    repository.deleteDocument.mockRejectedValue({ code: 'P2025' });

    await expect(
      service.getDocumentById(otherOrganizationId, sampleDocument.id)
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.deleteDocument(otherOrganizationId, sampleDocument.id)
    ).rejects.toThrow(NotFoundException);
  });

  it('returns content only through org-scoped read helpers', async () => {
    const { repository, service } = createService();
    repository.findById.mockResolvedValue(sampleDocument);

    await expect(
      service.getDocumentById(organizationId, sampleDocument.id)
    ).resolves.toEqual({
      id: 'doc-1',
      name: 'BRANDING.md',
      content: '# Branding\n\nUse this voice.',
      fileSize: 28,
      updatedAt: sampleDocument.updatedAt,
      isLarge: false,
    });
  });

  it('deletes owned documents through the repository contract', async () => {
    const { repository, service } = createService();
    repository.deleteDocument.mockResolvedValue(sampleDocument);

    await expect(
      service.deleteDocument(organizationId, sampleDocument.id)
    ).resolves.toEqual({ id: 'doc-1' });
    expect(repository.deleteDocument).toHaveBeenCalledWith(
      organizationId,
      sampleDocument.id
    );
  });
});
