'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';
import {
  ContextDocumentUploadResponse,
} from '@gitroom/frontend/components/context-documents/context-document.types';
import { CONTEXT_DOCUMENTS_KEY } from '@gitroom/frontend/components/context-documents/use.context-document.list';
import { PIPELINES_KEY } from '@gitroom/frontend/components/pipelines/use.pipeline.list';

const CONTEXT_DOCUMENTS_UPLOAD_KEY = '/context-documents/upload';

export const useContextDocumentUpload = () => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();

  return useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append('file', file, file.name);

      const response = await fetch(CONTEXT_DOCUMENTS_UPLOAD_KEY, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const uploaded = (await response.json()) as ContextDocumentUploadResponse;

      await Promise.all([
        mutate(CONTEXT_DOCUMENTS_KEY),
        mutate(PIPELINES_KEY),
      ]);

      return uploaded;
    },
    [fetch, mutate]
  );
};
