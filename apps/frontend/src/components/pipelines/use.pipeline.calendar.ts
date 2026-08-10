'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export const pipelineCalendarKey = (
  startDate: string,
  endDate: string,
  customer?: string | null
) => {
  const params = new URLSearchParams({ startDate, endDate });
  if (customer) {
    params.set('customer', customer);
  }
  return `/pipelines/calendar?${params.toString()}`;
};

export const usePipelineCalendar = (
  startDate: string,
  endDate: string,
  enabled = true,
  customer?: string | null
) => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return (await fetch(pipelineCalendarKey(startDate, endDate, customer))).json();
  }, [fetch, startDate, endDate, customer]);

  return useSWR<any[]>(
    enabled ? pipelineCalendarKey(startDate, endDate, customer) : null,
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
