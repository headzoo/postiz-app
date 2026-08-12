'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ProviderPlugListResponse } from '@gitroom/frontend/components/plugs/plugs.context';
import { loadProviderPlugList } from '@gitroom/frontend/components/plugs/plug.utils';

export const PROVIDER_PLUG_LIST_KEY = '/integrations/plug/list';

export const useProviderPlugList = () => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return loadProviderPlugList(fetch, PROVIDER_PLUG_LIST_KEY);
  }, [fetch]);

  return useSWR<ProviderPlugListResponse>(PROVIDER_PLUG_LIST_KEY, load, {
    fallbackData: { plugs: [] },
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
};
