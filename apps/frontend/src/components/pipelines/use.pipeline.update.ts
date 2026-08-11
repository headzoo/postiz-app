'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  PipelineDetail,
  UpdatePipelinePayload,
} from '@gitroom/frontend/components/pipelines/pipeline.types';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';
import { PIPELINES_KEY } from '@gitroom/frontend/components/pipelines/use.pipeline.list';
import { pipelineDetailKey } from '@gitroom/frontend/components/pipelines/use.pipeline.detail';
import { CONTEXT_DOCUMENTS_KEY } from '@gitroom/frontend/components/context-documents/use.context-document.list';

export const useUpdatePipeline = () => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();

  return useCallback(
    async (id: string, payload: UpdatePipelinePayload) => {
      const response = await fetch(pipelineDetailKey(id), {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      const updated = (await response.json()) as PipelineDetail;
      await Promise.all([
        mutate(PIPELINES_KEY),
        mutate(pipelineDetailKey(id)),
        mutate(CONTEXT_DOCUMENTS_KEY),
      ]);
      return updated;
    },
    [fetch, mutate]
  );
};
