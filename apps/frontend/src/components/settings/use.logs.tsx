'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';

export type PostHttpLogRow = {
  id: string;
  organizationId: string;
  postId?: string | null;
  integrationId?: string | null;
  provider: string;
  method: string;
  url: string;
  statusCode?: number | null;
  requestHeaders: string;
  requestBody: string;
  responseHeaders: string;
  responseBody: string;
  error?: string | null;
  createdAt: string;
};

export type WebhookHttpLogRow = {
  id: string;
  organizationId: string;
  webhookId?: string | null;
  integrationId?: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  source: 'ORG_WEBHOOK' | 'CHANNEL_WEBHOOK' | 'TEST';
  method: string;
  url: string;
  statusCode?: number | null;
  requestHeaders: string;
  requestBody: string;
  responseHeaders: string;
  responseBody: string;
  error?: string | null;
  sourceDisplayName?: string | null;
  sourceUsername?: string | null;
  targetDisplayName?: string | null;
  targetUsername?: string | null;
  createdAt: string;
};

export type LogsResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export const usePostLogs = (page: number, limit: number) => {
  const fetch = useFetch();
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const key = `/logs/posts?${query.toString()}`;
  return useSWR<LogsResponse<PostHttpLogRow>>(key, async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Failed to load post logs');
    }
    return res.json();
  });
};

export const useWebhookLogs = (
  page: number,
  limit: number,
  direction?: 'INBOUND' | 'OUTBOUND' | ''
) => {
  const fetch = useFetch();
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(direction ? { direction } : {}),
  });
  const key = `/logs/webhooks?${query.toString()}`;
  return useSWR<LogsResponse<WebhookHttpLogRow>>(key, async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Failed to load webhook logs');
    }
    return res.json();
  });
};
