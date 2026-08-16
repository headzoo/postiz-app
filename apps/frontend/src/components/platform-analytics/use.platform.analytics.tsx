'use client';

import { Integration } from '@prisma/client';
import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { AnalyticsDataItem } from '@gitroom/frontend/components/platform-analytics/render.analytics';

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

    return (
      await fetch(`/analytics/${integration.id}?date=${date}`)
    ).json();
  }, [integration, date, fetch]);

  return useSWR(
    integration ? `/analytics-${integration.id}-${date}` : null,
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
