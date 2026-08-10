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

export const useDashboardAnalytics = (date: 7 | 30 | 90) => {
  const fetch = useFetch();

  const load = useCallback(
    async (): Promise<DashboardChannelAnalytics[]> =>
      (await (await fetch(`/analytics/dashboard?date=${date}`)).json()),
    [date, fetch]
  );

  return useSWR<DashboardChannelAnalytics[]>(
    `/analytics/dashboard?date=${date}`,
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
