'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export const pipelineCalendarKey = (startDate: string, endDate: string) => {
  const params = new URLSearchParams({ startDate, endDate });
  return `/pipelines/calendar?${params.toString()}`;
};

export const usePipelineCalendar = (
  startDate: string,
  endDate: string,
  enabled = true
) => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return (await fetch(pipelineCalendarKey(startDate, endDate))).json();
  }, [fetch, startDate, endDate]);

  return useSWR<any[]>(
    enabled ? pipelineCalendarKey(startDate, endDate) : null,
    load,
    {
      refreshInterval: 3600000,
      refreshWhenOffline: false,
      refreshWhenHidden: false,
      revalidateOnFocus: false,
      fallbackData: [],
    }
  );
};
