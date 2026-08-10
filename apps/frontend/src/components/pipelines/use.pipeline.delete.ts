'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';
import { PIPELINES_KEY } from '@gitroom/frontend/components/pipelines/use.pipeline.list';
import { pipelineDetailKey } from '@gitroom/frontend/components/pipelines/use.pipeline.detail';

export const useDeletePipeline = () => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();

  return useCallback(
    async (id: string) => {
      const response = await fetch(pipelineDetailKey(id), {
        method: 'DELETE',
        body: JSON.stringify({ confirmDetach: true }),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      await Promise.all([
        mutate(PIPELINES_KEY),
        mutate(pipelineDetailKey(id), undefined, { revalidate: false }),
      ]);
      return response.json() as Promise<{ id: string; detached: boolean }>;
    },
    [fetch, mutate]
  );
};
