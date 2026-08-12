'use client';

import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { SavedPlugRow } from '@gitroom/frontend/components/plugs/plugs.context';
import { loadSavedPlugs } from '@gitroom/frontend/components/plugs/plug.utils';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';

export const pipelinePlugsKey = (pipelineId: string, integrationId: string) =>
  `/pipelines/${pipelineId}/plugs/${integrationId}`;

export const usePipelinePlugs = (
  pipelineId?: string,
  integrationId?: string
) => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return loadSavedPlugs(
      fetch,
      pipelinePlugsKey(pipelineId!, integrationId!)
    );
  }, [fetch, integrationId, pipelineId]);

  return useSWR<SavedPlugRow[]>(
    pipelineId && integrationId
      ? pipelinePlugsKey(pipelineId, integrationId)
      : null,
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

export const usePipelinePlugMutations = (
  pipelineId: string,
  integrationId: string
) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const key = pipelinePlugsKey(pipelineId, integrationId);

  const savePlug = useCallback(
    async (
      func: string,
      fields: Array<{ name: string; value: string }>
    ) => {
      const response = await fetch(key, {
        method: 'POST',
        body: JSON.stringify({ func, fields }),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      await mutate(key);
    },
    [fetch, key, mutate]
  );

  const activatePlug = useCallback(
    async (plugId: string, activated: boolean) => {
      const response = await fetch(
        `/pipelines/${pipelineId}/plugs/${plugId}/activate`,
        {
          method: 'PUT',
          body: JSON.stringify({ activated }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      await mutate(key);
    },
    [fetch, key, mutate, pipelineId]
  );

  const revalidate = useCallback(() => mutate(key), [key, mutate]);

  return { savePlug, activatePlug, revalidate };
};
