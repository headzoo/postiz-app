'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ReorderPipelineQueuePayload } from '@gitroom/frontend/components/pipelines/pipeline.types';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';
import { pipelineDetailKey } from '@gitroom/frontend/components/pipelines/use.pipeline.detail';
import { PIPELINES_KEY } from '@gitroom/frontend/components/pipelines/use.pipeline.list';

export const useReorderPipelineQueue = () => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();

  return useCallback(
    async (pipelineId: string, payload: ReorderPipelineQueuePayload) => {
      const response = await fetch(`/pipelines/${pipelineId}/items/reorder`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      await Promise.all([
        mutate(pipelineDetailKey(pipelineId)),
        mutate(PIPELINES_KEY),
      ]);
    },
    [fetch, mutate]
  );
};
