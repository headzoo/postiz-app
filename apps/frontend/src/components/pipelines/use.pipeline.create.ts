'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  CreatePipelinePayload,
  PipelineDetail,
} from '@gitroom/frontend/components/pipelines/pipeline.types';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';
import { PIPELINES_KEY } from '@gitroom/frontend/components/pipelines/use.pipeline.list';

export const useCreatePipeline = () => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();

  return useCallback(
    async (payload: CreatePipelinePayload) => {
      const response = await fetch(PIPELINES_KEY, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      const created = (await response.json()) as PipelineDetail;
      await mutate(PIPELINES_KEY);
      return created;
    },
    [fetch, mutate]
  );
};
