'use client';

import {
  ChangeEvent,
  FC,
  useCallback,
  useRef,
  useState,
} from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useDecisionModal } from '@gitroom/frontend/components/layout/new-modal';
import {
  CONTEXT_DOCUMENT_LARGE_WARNING_BYTES,
  CONTEXT_DOCUMENT_MAX_BYTES,
  ContextDocumentMetadata,
  formatContextDocumentSize,
  isContextDocumentLarge,
  normalizeContextDocumentName,
} from '@gitroom/frontend/components/context-documents/context-document.types';
import { useContextDocumentList } from '@gitroom/frontend/components/context-documents/use.context-document.list';
import { useContextDocumentUpload } from '@gitroom/frontend/components/context-documents/use.context-document.upload';
import { useContextDocumentDelete } from '@gitroom/frontend/components/context-documents/use.context-document.delete';

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

      <div className="flex justify-between items-center gap-[12px] flex-wrap">
        <Button onClick={handleUploadClick} loading={uploading}>
          {t('context_document_upload', 'Upload Markdown')}
        </Button>
      </div>

      {!data?.length ? (
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
            {t('context_document_upload', 'Upload Markdown')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-[12px]">
          {data.map((document) => (
            <div
              key={document.id}
              className={clsx(
                'rounded-[12px] border border-newBorder bg-newBgColor overflow-hidden',
                pendingId === document.id && 'opacity-70 pointer-events-none'
              )}
            >
              <div className="px-[20px] py-[16px] flex flex-col gap-[12px] lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-[8px] min-w-0">
                  <div className="flex items-center gap-[10px] flex-wrap">
                    <div className="text-[18px] font-[600] truncate">
                      {document.name}
                    </div>
                    {document.isLarge && (
                      <span className="text-[12px] px-[8px] py-[2px] rounded-full border border-amber-500/40 text-amber-500">
                        {t('context_document_large_badge', 'Large')}
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] opacity-70 flex flex-wrap gap-x-[12px] gap-y-[4px]">
                    <span>
                      {t('size', 'Size')}:{' '}
                      {formatContextDocumentSize(document.fileSize)} (
                      {document.fileSize.toLocaleString()} bytes)
                    </span>
                    <span>
                      {t('updated', 'Updated')}:{' '}
                      {dayjs(document.updatedAt).format('MMM D, YYYY · h:mm A')}
                    </span>
                  </div>
                  {document.warning && (
                    <div className="text-[13px] text-amber-500 max-w-[760px]">
                      {document.warning}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-[10px] flex-wrap">
                  <Button onClick={handleUploadClick} loading={uploading}>
                    {t('context_document_replace', 'Replace')}
                  </Button>
                  <Button secondary onClick={confirmDelete(document)}>
                    {t('delete', 'Delete')}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
