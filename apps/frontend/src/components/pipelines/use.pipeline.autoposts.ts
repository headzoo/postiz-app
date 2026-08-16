'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { PipelineAutopost } from '@gitroom/frontend/components/pipelines/pipeline.types';

export const pipelineAutopostsKey = (pipelineId: string) =>
  `/pipelines/${pipelineId}/autoposts`;

export const usePipelineAutoposts = (pipelineId?: string) => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return (await fetch(pipelineAutopostsKey(pipelineId!))).json() as Promise<
      PipelineAutopost[]
    >;
  }, [fetch, pipelineId]);

  return useSWR<PipelineAutopost[]>(
    pipelineId ? pipelineAutopostsKey(pipelineId) : null,
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
