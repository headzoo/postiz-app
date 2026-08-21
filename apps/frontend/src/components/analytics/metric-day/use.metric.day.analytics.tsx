'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export type MetricDayAnalyticsPost = {
  id: string;
  content: string;
  image?: string | null;
  publishDate: string;
  releaseId: string | null;
  releaseURL: string | null;
  delta: number;
};

export type MetricDayAnalyticsResponse = {
  metric: string;
  metricKey: string;
  date: string;
  page: number;
  limit: number;
  total: number;
  matchedPostDeltaTotal: number;
  unmatchedContributorCount: number;
  dailyPointTotal: number | null;
  reason?: 'no_post_lifetime_provenance';
  posts: MetricDayAnalyticsPost[];
};

export const useMetricDayAnalytics = (
  integrationId: string | undefined,
  metric: string | undefined,
  date: string | undefined,
  page = 0,
  limit = 50
) => {
  const fetch = useFetch();

  const load = useCallback(async (): Promise<MetricDayAnalyticsResponse> => {
    const response = await fetch(
      `/analytics/${integrationId}/${metric}/${date}?page=${page}&limit=${limit}`
    );
    if (!response.ok) {
      throw new Error('Failed to load metric day analytics');
    }
    return (await response.json()) as MetricDayAnalyticsResponse;
  }, [date, fetch, integrationId, limit, metric, page]);

  return useSWR<MetricDayAnalyticsResponse>(
    integrationId && metric && date
      ? `/analytics/${integrationId}/${metric}/${date}?page=${page}&limit=${limit}`
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
