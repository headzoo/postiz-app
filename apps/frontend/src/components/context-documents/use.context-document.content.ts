'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';
import { ContextDocumentContent } from '@gitroom/frontend/components/context-documents/context-document.types';

export const contextDocumentContentKey = (id: string) =>
  `/context-documents/${id}`;

export const useContextDocumentContent = (id: string) => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    const response = await fetch(contextDocumentContentKey(id));

    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    return response.json() as Promise<ContextDocumentContent>;
  }, [fetch, id]);

  return useSWR<ContextDocumentContent>(
    id ? contextDocumentContentKey(id) : null,
    load,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );
};
