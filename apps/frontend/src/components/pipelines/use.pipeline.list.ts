'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { PipelineSummary } from '@gitroom/frontend/components/pipelines/pipeline.types';

const PIPELINES_KEY = '/pipelines';

export const usePipelineList = () => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return (await fetch(PIPELINES_KEY)).json() as Promise<PipelineSummary[]>;
  }, [fetch]);

  return useSWR<PipelineSummary[]>(PIPELINES_KEY, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });
};

export { PIPELINES_KEY };
