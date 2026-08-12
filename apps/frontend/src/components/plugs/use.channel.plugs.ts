'use client';

import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { SavedPlugRow } from '@gitroom/frontend/components/plugs/plugs.context';
import { loadSavedPlugs } from '@gitroom/frontend/components/plugs/plug.utils';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';

export const channelPlugsKey = (integrationId: string) =>
  `channel-plugs-${integrationId}`;

export const useChannelPlugs = (integrationId?: string) => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return loadSavedPlugs(fetch, `/integrations/${integrationId}/plugs`);
  }, [fetch, integrationId]);

  return useSWR<SavedPlugRow[]>(
    integrationId ? channelPlugsKey(integrationId) : null,
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

export const useChannelPlugMutations = (integrationId: string) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const key = channelPlugsKey(integrationId);

  const savePlug = useCallback(
    async (
      func: string,
      fields: Array<{ name: string; value: string }>
    ) => {
      const response = await fetch(`/integrations/${integrationId}/plugs`, {
        method: 'POST',
        body: JSON.stringify({ func, fields }),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      await mutate(key);
    },
    [fetch, integrationId, key, mutate]
  );

  const activatePlug = useCallback(
    async (plugId: string, activated: boolean) => {
      const response = await fetch(`/integrations/plugs/${plugId}/activate`, {
        method: 'PUT',
        body: JSON.stringify({ status: activated }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      await mutate(key);
    },
    [fetch, key, mutate]
  );

  const revalidate = useCallback(() => mutate(key), [key, mutate]);

  return { savePlug, activatePlug, revalidate };
};
