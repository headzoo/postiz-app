'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  PipelineDetail,
  UpdatePipelineSchedulePayload,
} from '@gitroom/frontend/components/pipelines/pipeline.types';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';
import { pipelineDetailKey } from '@gitroom/frontend/components/pipelines/use.pipeline.detail';
import { PIPELINES_KEY } from '@gitroom/frontend/components/pipelines/use.pipeline.list';

export const useUpdatePipelineSchedule = () => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();

  return useCallback(
    async (id: string, payload: UpdatePipelineSchedulePayload) => {
      const response = await fetch(`${pipelineDetailKey(id)}/schedule`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      const updated = (await response.json()) as PipelineDetail;
      await Promise.all([mutate(pipelineDetailKey(id)), mutate(PIPELINES_KEY)]);
      return updated;
    },
    [fetch, mutate]
  );
};
