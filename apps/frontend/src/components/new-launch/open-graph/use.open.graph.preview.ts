'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useDebounce } from 'use-debounce';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { extractFirstComposerUrl } from './extract.first.composer.url';
import { OpenGraphResponse } from './open.graph.types';

const OPEN_GRAPH_SWR_KEY = 'open-graph';

type OpenGraphSwrKey = [typeof OPEN_GRAPH_SWR_KEY, string];

export const useOpenGraphPreview = (content?: string | null) => {
  const fetch = useFetch();
  const contentUrl = useMemo(() => extractFirstComposerUrl(content), [content]);
  const [debouncedUrl] = useDebounce(contentUrl, 300);
  const swrKey: OpenGraphSwrKey | null = debouncedUrl
    ? [OPEN_GRAPH_SWR_KEY, debouncedUrl]
    : null;

  const load = useCallback(
    async (key: OpenGraphSwrKey) => {
      const [, url] = key;
      const response = await fetch('/media/open-graph', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('OpenGraph request failed');
      }

      const data = (await response.json()) as OpenGraphResponse;

      if (!data || typeof data.url !== 'string') {
        throw new Error('Invalid OpenGraph response');
      }

      return data;
    },
    [fetch]
  );

  const swr = useSWR(swrKey, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    dedupingInterval: 60000,
  });

  return {
    ...swr,
    contentUrl,
    requestUrl: debouncedUrl,
  };
};
