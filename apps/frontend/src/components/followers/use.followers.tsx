'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

export type FollowerSortDirection = 'asc' | 'desc';

export type FollowerSort = {
  key: string;
  label: string;
  directions: FollowerSortDirection[];
  defaultDirection: FollowerSortDirection;
};

export type FollowerChannel = {
  id: string;
  name: string;
  picture?: string;
  display?: string;
  identifier: string;
  sorts: FollowerSort[];
};

export type Follower = {
  id: string;
  name: string;
  username?: string;
  picture?: string;
  profileUrl?: string;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
  influenceScore?: number;
  followedAt?: string;
  accountCreatedAt?: string;
};

export type FollowerPage = {
  items: Follower[];
  total?: number;
  nextCursor?: string;
  previousCursor?: string;
  hasMore: boolean;
};

export const useFollowerChannels = () => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    const response = await fetch('/followers/channels');
    if (!response.ok) {
      throw new Error('Failed to load follower channels');
    }
    return (await response.json()) as FollowerChannel[];
  }, [fetch]);

  return useSWR<FollowerChannel[]>('/followers/channels', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });
};

export type UseFollowersParams = {
  integrationId?: string;
  cursor?: string;
  limit: number;
  sort?: string;
  direction?: FollowerSortDirection;
};

const buildFollowersUrl = ({
  integrationId,
  cursor,
  limit,
  sort,
  direction,
}: UseFollowersParams & { integrationId: string }) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    params.set('cursor', cursor);
  }
  if (sort) {
    params.set('sort', sort);
    if (direction) {
      params.set('direction', direction);
    }
  }
  return `/followers/${integrationId}?${params.toString()}`;
};

export const useFollowers = ({
  integrationId,
  cursor,
  limit,
  sort,
  direction,
}: UseFollowersParams) => {
  const fetch = useFetch();

  const url = useMemo(() => {
    if (!integrationId) {
      return null;
    }
    return buildFollowersUrl({
      integrationId,
      cursor,
      limit,
      sort,
      direction,
    });
  }, [integrationId, cursor, limit, sort, direction]);

  const load = useCallback(
    async (path: string) => {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error('Failed to load followers');
      }
      return (await response.json()) as FollowerPage;
    },
    [fetch]
  );

  return useSWR<FollowerPage>(url, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
};
