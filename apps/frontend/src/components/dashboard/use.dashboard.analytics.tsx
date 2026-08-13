'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback } from 'react';
import useSWR from 'swr';

export type DashboardAnalyticsMetric = {
  label: string;
  data: Array<{ total: number; date: string }>;
  average?: boolean;
  percentageChange?: number;
};

export type DashboardChannelAnalytics = {
  id: string;
  name: string;
  picture?: string | null;
  display?: string | null;
  identifier: string;
  state: 'ok' | 'unsupported' | 'unavailable' | 'disabled';
  analytics: DashboardAnalyticsMetric[];
};

export const useDashboardAnalytics = (
  date: 7 | 30 | 90,
  integrationId?: string
) => {
  const fetch = useFetch();

  const load = useCallback(
    async (): Promise<DashboardChannelAnalytics[]> =>
    (
      await (
        await fetch(
          `/analytics/dashboard?date=${date}&integrationId=${integrationId}`
        )
      ).json()
    ),
    [date, fetch, integrationId]
  );

  return useSWR<DashboardChannelAnalytics[]>(
    integrationId
      ? `/analytics/dashboard?date=${date}&integrationId=${integrationId}`
      : null,
    load,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );
};
