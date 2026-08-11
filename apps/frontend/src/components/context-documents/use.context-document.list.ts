'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ContextDocumentMetadata } from '@gitroom/frontend/components/context-documents/context-document.types';

const CONTEXT_DOCUMENTS_KEY = '/context-documents';

export const useContextDocumentList = () => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return (await fetch(CONTEXT_DOCUMENTS_KEY)).json() as Promise<
      ContextDocumentMetadata[]
    >;
  }, [fetch]);

  return useSWR<ContextDocumentMetadata[]>(CONTEXT_DOCUMENTS_KEY, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });
};

export { CONTEXT_DOCUMENTS_KEY };
