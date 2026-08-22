'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { AdminScheduleLogSlug } from '@gitroom/nestjs-libraries/database/prisma/admin-schedule-logs/admin-schedule-log.slugs';

export type AdminScheduleLogRow = {
  id: string;
  scheduleKey: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  meta: string;
  createdAt: string;
};

export type AdminScheduleLogsResponse = {
  items: AdminScheduleLogRow[];
  limit: number;
};

export const useAdminScheduleLogs = (key: AdminScheduleLogSlug) => {
  const fetch = useFetch();
  const query = new URLSearchParams({
    key,
    limit: '100',
  });
  const url = `/admin/schedule/logs?${query.toString()}`;
  return useSWR<AdminScheduleLogsResponse>(
    url,
    async (path: string) => {
      const res = await fetch(path);
      if (!res.ok) {
        throw new Error('Failed to load schedule logs');
      }
      return res.json();
    },
    {
      refreshInterval: 2000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
};
