export const CONTEXT_DOCUMENT_MAX_BYTES = 256 * 1024;
export const CONTEXT_DOCUMENT_LARGE_WARNING_BYTES = 128 * 1024;

export type ContextDocumentMetadata = {
  id: string;
  organizationId: string;
  name: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  isLarge: boolean;
  warning?: string;
};

export type ContextDocumentContent = {
  id: string;
  name: string;
  content: string;
  fileSize: number;
  updatedAt: string;
  isLarge: boolean;
  warning?: string;
};

export type ContextDocumentUploadResponse = ContextDocumentMetadata;

const ALLOWED_EXTENSIONS = ['.markdown', '.md'] as const;

export const normalizeContextDocumentName = (
  originalName: string
): string | null => {
  const basename = (originalName || '').replace(/\\/g, '/').split('/').pop()?.trim();

  if (!basename) {
    return null;
  }

  const lower = basename.toLowerCase();
  const extension = ALLOWED_EXTENSIONS.find((value) => lower.endsWith(value));

  if (!extension) {
    return null;
  }

  const stem = basename.slice(0, basename.length - extension.length).trim();

  if (!stem) {
    return null;
  }

  const normalizedName = `${stem}${extension}`;

  if (normalizedName.length > 255) {
    return null;
  }

  return normalizedName;
};

export const formatContextDocumentSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(kilobytes < 10 ? 1 : 0)} KiB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MiB`;
};

export const isContextDocumentLarge = (fileSize: number): boolean =>
  fileSize >= CONTEXT_DOCUMENT_LARGE_WARNING_BYTES;
