'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';
import {
  PipelineAutopost,
  PipelineAutopostPayload,
} from '@gitroom/frontend/components/pipelines/pipeline.types';
import { pipelineAutopostsKey } from '@gitroom/frontend/components/pipelines/use.pipeline.autoposts';

export const usePipelineAutopostMutations = (pipelineId: string) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const key = pipelineAutopostsKey(pipelineId);

  const invalidate = useCallback(() => mutate(key), [key, mutate]);

  const createAutopost = useCallback(
    async (body: PipelineAutopostPayload) => {
      const response = await fetch(key, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      const result = (await response.json()) as PipelineAutopost;
      await mutate(key);
      return result;
    },
    [fetch, key, mutate]
  );

  const updateAutopost = useCallback(
    async (id: string, body: PipelineAutopostPayload) => {
      const response = await fetch(`${key}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      const result = (await response.json()) as PipelineAutopost;
      await mutate(key);
      return result;
    },
    [fetch, key, mutate]
  );

  const deleteAutopost = useCallback(
    async (id: string) => {
      const response = await fetch(`${key}/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      await mutate(key);
    },
    [fetch, key, mutate]
  );

  const toggleAutopostActive = useCallback(
    async (id: string, active: boolean) => {
      const response = await fetch(`${key}/${id}/active`, {
        method: 'POST',
        body: JSON.stringify({ active }),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      await mutate(key);
    },
    [fetch, key, mutate]
  );

  return {
    createAutopost,
    updateAutopost,
    deleteAutopost,
    toggleAutopostActive,
    invalidate,
  };
};
