'use client';

import { Integration } from '@prisma/client';
import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { AnalyticsDataItem } from '@gitroom/frontend/components/platform-analytics/render.analytics';
import { DashboardChannelAnalytics } from '@gitroom/frontend/components/dashboard/use.dashboard.analytics';

export const usePlatformAnalytics = (
  integration: Integration | undefined,
  date: number,
  refreshInterval = 0
) => {
  const fetch = useFetch();

  const load = useCallback(async (): Promise<AnalyticsDataItem[]> => {
    if (!integration) {
      return [];
    }

    const channels = (await (
      await fetch(
        `/analytics/dashboard?date=${date}&integrationId=${integration.id}`
      )
    ).json()) as DashboardChannelAnalytics[];

    return channels?.[0]?.analytics ?? [];
  }, [integration, date, fetch]);

  return useSWR(
    integration
      ? `/analytics/dashboard?date=${date}&integrationId=${integration.id}`
      : null,
    load,
    {
      refreshInterval,
      refreshWhenHidden: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      refreshWhenOffline: false,
      revalidateOnMount: true,
    }
  );
};
