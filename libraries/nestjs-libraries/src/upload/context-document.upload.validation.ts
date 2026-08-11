import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

export const CONTEXT_DOCUMENT_MAX_BYTES = 256 * 1024;
export const CONTEXT_DOCUMENT_LARGE_WARNING_BYTES = 128 * 1024;

const ALLOWED_EXTENSIONS = new Set(['.md', '.markdown']);
const MAX_FILENAME_LENGTH = 255;

export type ValidatedContextDocumentUpload = {
  name: string;
  content: string;
  fileSize: number;
};

export function isContextDocumentLarge(fileSize: number): boolean {
  return fileSize >= CONTEXT_DOCUMENT_LARGE_WARNING_BYTES;
}

export function getContextDocumentLargeWarning(
  fileSize: number
): string | undefined {
  if (!isContextDocumentLarge(fileSize)) {
    return undefined;
  }

  return `This document is ${fileSize} bytes and may be too large for reliable agent use. Consider splitting it into smaller files.`;
}

export function normalizeContextDocumentName(originalName: string): string {
  const basename = path
    .basename((originalName || '').replace(/\\/g, '/'))
    .trim();

  if (!basename) {
    throw new BadRequestException('A Markdown filename is required.');
  }

  const extension = path.extname(basename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new BadRequestException(
      'Only .md and .markdown files are supported.'
    );
  }

  const stem = basename.slice(0, basename.length - extension.length).trim();
  if (!stem) {
    throw new BadRequestException('A Markdown filename is required.');
  }

  const normalizedName = `${stem}${extension}`;
  if (normalizedName.length > MAX_FILENAME_LENGTH) {
    throw new BadRequestException('The Markdown filename is too long.');
  }

  return normalizedName;
}

export function decodeUtf8Fatal(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new BadRequestException('The uploaded file must be valid UTF-8 text.');
  }
}

export function validateContextDocumentUpload(
  file?: Pick<Express.Multer.File, 'buffer' | 'size' | 'originalname'>
): ValidatedContextDocumentUpload {
  if (!file) {
    throw new BadRequestException('A Markdown file is required.');
  }

  if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new BadRequestException('A Markdown file is required.');
  }

  const fileSize = file.buffer.length;
  if (fileSize === 0) {
    throw new BadRequestException('The uploaded file is empty.');
  }

  if (fileSize > CONTEXT_DOCUMENT_MAX_BYTES) {
    throw new BadRequestException(
      `The uploaded file exceeds the ${CONTEXT_DOCUMENT_MAX_BYTES} byte limit.`
    );
  }

  if (typeof file.size === 'number' && file.size > CONTEXT_DOCUMENT_MAX_BYTES) {
    throw new BadRequestException(
      `The uploaded file exceeds the ${CONTEXT_DOCUMENT_MAX_BYTES} byte limit.`
    );
  }

  const name = normalizeContextDocumentName(file.originalname || '');
  const content = decodeUtf8Fatal(file.buffer);

  if (!content.trim()) {
    throw new BadRequestException('The uploaded file is empty.');
  }

  if (content.includes('\0')) {
    throw new BadRequestException(
      'The uploaded file contains invalid null bytes.'
    );
  }

  return {
    name,
    content,
    fileSize,
  };
}
