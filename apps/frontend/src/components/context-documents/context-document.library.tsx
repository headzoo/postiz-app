'use client';

import {
  ChangeEvent,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useClickOutside } from '@mantine/hooks';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import Loading, {
  LoadingComponent,
} from '@gitroom/frontend/components/layout/loading';
import {
  useDecisionModal,
  useModals,
} from '@gitroom/frontend/components/layout/new-modal';
import {
  CONTEXT_DOCUMENT_LARGE_WARNING_BYTES,
  CONTEXT_DOCUMENT_MAX_BYTES,
  ContextDocumentMetadata,
  formatContextDocumentSize,
  isContextDocumentLarge,
  normalizeContextDocumentName,
} from '@gitroom/frontend/components/context-documents/context-document.types';
import { useContextDocumentList } from '@gitroom/frontend/components/context-documents/use.context-document.list';
import { useContextDocumentContent } from '@gitroom/frontend/components/context-documents/use.context-document.content';
import { useContextDocumentUpload } from '@gitroom/frontend/components/context-documents/use.context-document.upload';
import { useContextDocumentDelete } from '@gitroom/frontend/components/context-documents/use.context-document.delete';

const ContextDocumentMarkdown: FC<{
  content: string;
}> = ({ content }) => {
  return (
    <div
      className={clsx(
        'whitespace-normal text-[14px] leading-[1.6] text-textColor',
        '[&_h1]:text-[24px] [&_h1]:font-[600] [&_h1]:mb-[12px] [&_h1]:mt-[8px]',
        '[&_h2]:text-[20px] [&_h2]:font-[600] [&_h2]:mb-[10px] [&_h2]:mt-[16px]',
        '[&_h3]:text-[16px] [&_h3]:font-[600] [&_h3]:mb-[8px] [&_h3]:mt-[14px]',
        '[&_p]:mb-[10px]',
        '[&_ul]:list-disc [&_ul]:ps-[20px] [&_ul]:mb-[10px]',
        '[&_ol]:list-decimal [&_ol]:ps-[20px] [&_ol]:mb-[10px]',
        '[&_li]:mb-[4px]',
        '[&_blockquote]:border-s-[3px] [&_blockquote]:border-newBorder [&_blockquote]:ps-[12px] [&_blockquote]:opacity-80 [&_blockquote]:mb-[10px]',
        '[&_pre]:bg-newBgColor [&_pre]:p-[12px] [&_pre]:rounded-[8px] [&_pre]:overflow-x-auto [&_pre]:mb-[10px] [&_pre]:text-[13px]',
        '[&_code]:font-mono [&_code]:text-[13px]',
        '[&_a]:underline',
        '[&_hr]:border-newBorder [&_hr]:my-[16px]',
        '[&_table]:w-full [&_table]:mb-[12px] [&_th]:border [&_td]:border [&_th]:border-newBorder [&_td]:border-newBorder [&_th]:p-[6px] [&_td]:p-[6px] [&_th]:text-start',
        '[&_img]:max-w-full [&_img]:rounded-[8px]'
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

const ContextDocumentReader: FC<{ documentId: string }> = ({ documentId }) => {
  const t = useT();
  const { data, error, isLoading } = useContextDocumentContent(documentId);

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-[40px]">
        <Loading width={40} height={40} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-[14px] text-red-500">
        {t(
          'context_document_read_error',
          'Failed to load this document. Please try again.'
        )}
      </div>
    );
  }

  return (
    <ContextDocumentMarkdown content={data.content} />
  );
};

const ContextDocumentMenu: FC<{
  disabled?: boolean;
  onReplace: () => void;
  onDelete: () => void;
}> = ({ disabled, onReplace, onDelete }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-label={t('context_document_actions', 'Document actions')}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center justify-center w-[28px] h-[28px] rounded-[6px] text-menuDots hover:text-menuDotsHover hover:bg-newBgColor disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M13.125 12C13.125 12.2225 13.059 12.44 12.9354 12.625C12.8118 12.81 12.6361 12.9542 12.4305 13.0394C12.225 13.1245 11.9988 13.1468 11.7805 13.1034C11.5623 13.06 11.3618 12.9528 11.2045 12.7955C11.0472 12.6382 10.94 12.4377 10.8966 12.2195C10.8532 12.0012 10.8755 11.775 10.9606 11.5695C11.0458 11.3639 11.19 11.1882 11.375 11.0646C11.56 10.941 11.7775 10.875 12 10.875C12.2984 10.875 12.5845 10.9935 12.7955 11.2045C13.0065 11.4155 13.125 11.7016 13.125 12ZM12 6.75C12.2225 6.75 12.44 6.68402 12.625 6.5604C12.81 6.43679 12.9542 6.26109 13.0394 6.05552C13.1245 5.84995 13.1468 5.62375 13.1034 5.40552C13.06 5.1873 12.9528 4.98684 12.7955 4.82951C12.6382 4.67217 12.4377 4.56503 12.2195 4.52162C12.0012 4.47821 11.775 4.50049 11.5695 4.58564C11.3639 4.67078 11.1882 4.81498 11.0646 4.99998C10.941 5.18499 10.875 5.4025 10.875 5.625C10.875 5.92337 10.9935 6.20952 11.2045 6.4205C11.4155 6.63147 11.7016 6.75 12 6.75ZM12 17.25C11.7775 17.25 11.56 17.316 11.375 17.4396C11.19 17.5632 11.0458 17.7389 10.9606 17.9445C10.8755 18.15 10.8532 18.3762 10.8966 18.5945C10.94 18.8127 11.0472 19.0132 11.2045 19.1705C11.3618 19.3278 11.5623 19.435 11.7805 19.4784C11.9988 19.5218 12.225 19.4995 12.4305 19.4144C12.6361 19.3292 12.8118 19.185 12.9354 19C13.059 18.815 13.125 18.5975 13.125 18.375C13.125 18.0766 13.0065 17.7905 12.7955 17.5795C12.5845 17.3685 12.2984 17.25 12 17.25Z"
            fill="currentColor"
          />
        </svg>
      </button>
      {open && (
        <div className="z-[300] absolute end-0 bottom-full mb-[6px] min-w-[140px] bg-newBgColorInner p-[8px] menu-shadow flex flex-col rounded-[8px] border border-newBorder">
          <button
            type="button"
            onClick={run(onReplace)}
            className="px-[10px] py-[8px] text-[13px] rounded-[6px] text-start hover:bg-newBgColor"
          >
            {t('context_document_replace', 'Replace')}
          </button>
          <button
            type="button"
            onClick={run(onDelete)}
            className="px-[10px] py-[8px] text-[13px] rounded-[6px] text-start hover:bg-newBgColor"
          >
            {t('delete', 'Delete')}
          </button>
        </div>
      )}
    </div>
  );
};

const ContextDocumentCard: FC<{
  document: ContextDocumentMetadata;
  pending: boolean;
  uploading: boolean;
  onReplace: () => void;
  onDelete: () => void;
}> = ({ document, pending, uploading, onReplace, onDelete }) => {
  const t = useT();
  const modal = useModals();

  const openReader = useCallback(() => {
    modal.openModal({
      title: document.name,
      size: '840px',
      maxSize: '90vw',
      children: <ContextDocumentReader documentId={document.id} />,
    });
  }, [document.id, document.name, modal]);

  return (
    <div
      className={clsx(
        'rounded-[8px] border border-newBorder bg-newBgColorInner flex',
        pending && 'opacity-70 pointer-events-none'
      )}
    >
      <button
        type="button"
        onClick={openReader}
        aria-label={t('context_document_open', 'Open document')}
        className="min-w-0 flex-1 p-[12px] flex flex-col gap-[8px] text-start"
      >
        <div className="min-w-0 flex items-center gap-[6px]">
          <span className="font-[600] text-[13px] truncate min-w-0 flex-1">
            {document.name}
          </span>
          {document.isLarge && (
            <span className="shrink-0 text-[11px] px-[7px] py-[2px] rounded-full border border-amber-500/40 text-amber-500">
              {t('context_document_large_badge', 'Large')}
            </span>
          )}
        </div>
        <div className="text-[12px] opacity-70">
          {t('size', 'Size')}: {formatContextDocumentSize(document.fileSize)} (
          {document.fileSize.toLocaleString()} bytes)
        </div>
        {document.warning && (
          <div className="text-[12px] text-amber-500">{document.warning}</div>
        )}
      </button>
      <div className="shrink-0 p-[12px] ps-0">
        <ContextDocumentMenu
          disabled={pending || uploading}
          onReplace={onReplace}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
};

export const ContextDocumentLibrary: FC = () => {
  const t = useT();
  const toaster = useToaster();
  const decision = useDecisionModal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, error, isLoading, mutate } = useContextDocumentList();
  const uploadDocument = useContextDocumentUpload();
  const deleteDocument = useContextDocumentDelete();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');

  const documents = data || [];
  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return documents;
    }
    return documents.filter((document) =>
      document.name.toLowerCase().includes(query)
    );
  }, [documents, search]);

  useEffect(() => {
    if (!documents.length && search) {
      setSearch('');
    }
  }, [documents.length, search]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';

      if (!file) {
        return;
      }

      const normalizedName = normalizeContextDocumentName(file.name);

      if (!normalizedName) {
        toaster.show(
          t(
            'context_document_invalid_extension',
            'Only .md and .markdown files are supported.'
          ),
          'warning'
        );
        return;
      }

      if (file.size > CONTEXT_DOCUMENT_MAX_BYTES) {
        toaster.show(
          t(
            'context_document_oversize',
            'This file exceeds the 256 KiB limit and cannot be uploaded.'
          ),
          'warning'
        );
        return;
      }

      const existing = data?.find((document) => document.name === normalizedName);

      if (existing) {
        const approved = await decision.open({
          title: t('context_document_replace_title', 'Replace existing document?'),
          description: t(
            'context_document_replace_description',
            `"${normalizedName}" already exists in your organization library. Uploading will replace its content while keeping the same document id. Pipeline assignments will continue to reference this document.`
          ),
          approveLabel: t('context_document_replace_confirm', 'Replace document'),
          cancelLabel: t('cancel', 'Cancel'),
        });

        if (!approved) {
          return;
        }
      }

      if (isContextDocumentLarge(file.size)) {
        const approved = await decision.open({
          title: t('context_document_large_title', 'Large document warning'),
          description: t(
            'context_document_large_description',
            `"${normalizedName}" is ${formatContextDocumentSize(file.size)} (${file.size.toLocaleString()} bytes). Documents at or above ${formatContextDocumentSize(CONTEXT_DOCUMENT_LARGE_WARNING_BYTES)} may be too large for reliable agent use. Consider splitting it into smaller files.`
          ),
          approveLabel: t('context_document_upload_anyway', 'Upload anyway'),
          cancelLabel: t('cancel', 'Cancel'),
        });

        if (!approved) {
          return;
        }
      }

      setUploading(true);

      try {
        const uploaded = await uploadDocument(file);
        await mutate();

        toaster.show(
          existing
            ? t(
              'context_document_replaced_success',
              'Document replaced successfully.'
            )
            : t(
              'context_document_uploaded_success',
              'Document uploaded successfully.'
            ),
          'success'
        );

        if (uploaded.warning) {
          toaster.show(uploaded.warning, 'warning');
        }
      } catch (err: any) {
        toaster.show(
          err?.message ||
          t(
            'context_document_upload_error',
            'Failed to upload document. Please try again.'
          ),
          'warning'
        );
      } finally {
        setUploading(false);
      }
    },
    [data, decision, mutate, t, toaster, uploadDocument]
  );

  const confirmDelete = useCallback(
    (document: ContextDocumentMetadata) => async () => {
      const approved = await decision.open({
        title: t('context_document_delete_title', 'Delete document?'),
        description: t(
          'context_document_delete_description',
          `Deleting "${document.name}" will remove it from your organization library and detach it from any Pipelines. Queued posts are not affected.`
        ),
        approveLabel: t('context_document_delete_confirm', 'Delete document'),
        cancelLabel: t('cancel', 'Cancel'),
      });

      if (!approved) {
        return;
      }

      setPendingId(document.id);

      try {
        await deleteDocument(document.id);
        await mutate();
        toaster.show(
          t(
            'context_document_deleted_success',
            'Document deleted. Pipeline assignments were removed.'
          ),
          'success'
        );
      } catch (err: any) {
        toaster.show(
          err?.message ||
          t(
            'context_document_delete_error',
            'Failed to delete document. Please try again.'
          ),
          'warning'
        );
      } finally {
        setPendingId(null);
      }
    },
    [decision, deleteDocument, mutate, t, toaster]
  );

  if (isLoading) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] transition-all items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  return (
    <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[20px] transition-all text-textColor">
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="flex flex-col gap-[6px]">
        <h1 className="text-[24px] font-[600]">
          {t('context_documents', 'Context documents')} ({data?.length || 0})
        </h1>
        <p className="text-[14px] opacity-70 max-w-[760px]">
          {t(
            'context_documents_description',
            'Upload reusable Markdown files for your organization. Attach them to Pipelines so the agent can read on-brand guidance when drafting posts. Maximum file size is 256 KiB.'
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-[12px] border border-red-500/30 bg-newBgColor px-[16px] py-[12px] text-[14px] text-red-500">
          {t(
            'context_documents_load_error',
            'Failed to load context documents. Please refresh and try again.'
          )}
        </div>
      )}

      <div className="flex items-center gap-[12px] flex-wrap">
        {!!documents.length && (
          <div className="flex-1 min-w-[220px]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t(
                'search_context_documents',
                'Search documents by name'
              )}
              className="w-full h-[40px] px-[12px] rounded-[8px] bg-newBgColor border border-newColColor text-[14px] outline-none focus:border-[#612BD3]"
            />
          </div>
        )}
        <Button onClick={handleUploadClick} loading={uploading}>
          {t('context_document_upload', '+ Upload')}
        </Button>
      </div>

      {!documents.length ? (
        <div className="rounded-[12px] border border-newBorder bg-newBgColor p-[32px] flex flex-col items-center justify-center gap-[12px] text-center">
          <div className="text-[18px] font-[600]">
            {t('context_documents_empty_title', 'No context documents yet')}
          </div>
          <div className="text-[14px] opacity-70 max-w-[520px]">
            {t(
              'context_documents_empty_description',
              'Upload .md or .markdown files such as BRANDING.md or TONE.md, then attach them to Pipelines for agent guidance.'
            )}
          </div>
          <Button onClick={handleUploadClick} loading={uploading}>
            {t('context_document_upload', '+ Upload')}
          </Button>
        </div>
      ) : !filteredDocuments.length ? (
        <div className="rounded-[12px] border border-newBorder bg-newBgColor p-[32px] flex flex-col items-center justify-center gap-[12px] text-center">
          <div className="text-[18px] font-[600]">
            {t('no_matching_documents', 'No documents match your search.')}
          </div>
          <div className="text-[14px] opacity-70 max-w-[520px]">
            {t(
              'context_documents_search_empty_description',
              'Try a different file name, or clear the search to see all documents.'
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[12px]">
          {filteredDocuments.map((document) => (
            <ContextDocumentCard
              key={document.id}
              document={document}
              pending={pendingId === document.id}
              uploading={uploading}
              onReplace={handleUploadClick}
              onDelete={confirmDelete(document)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
