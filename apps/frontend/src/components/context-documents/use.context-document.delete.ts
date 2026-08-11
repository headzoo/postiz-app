'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';
import { CONTEXT_DOCUMENTS_KEY } from '@gitroom/frontend/components/context-documents/use.context-document.list';
import { contextDocumentContentKey } from '@gitroom/frontend/components/context-documents/use.context-document.content';
import { PIPELINES_KEY } from '@gitroom/frontend/components/pipelines/use.pipeline.list';

export const useContextDocumentDelete = () => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();

  return useCallback(
    async (id: string) => {
      const response = await fetch(`${CONTEXT_DOCUMENTS_KEY}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const deleted = (await response.json()) as { id: string };

      await Promise.all([
        mutate(CONTEXT_DOCUMENTS_KEY),
        mutate(PIPELINES_KEY),
        mutate(contextDocumentContentKey(id), undefined, { revalidate: false }),
      ]);

      return deleted;
    },
    [fetch, mutate]
  );
};
