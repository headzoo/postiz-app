'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

export type FollowerSortDirection = 'asc' | 'desc';

export type FollowerSortScope = 'native' | 'page' | 'database';

export type ChannelInteractionWindow = 'week' | 'month' | '90_day' | 'year';

export type ChannelInteractionTrackingState =
  | 'unconfigured'
  | 'provisioning'
  | 'active'
  | 'partial'
  | 'error'
  | 'unsupported';

export type ChannelInteractionCoverageLevel =
  | 'supported'
  | 'partial'
  | 'unsupported';

export type ChannelInteractionTrackingFailureCategory =
  | 'configuration'
  | 'authentication'
  | 'authorization'
  | 'entitlement'
  | 'quota'
  | 'transient'
  | 'unknown';

export type ChannelInteractionKind =
  | 'like'
  | 'reply'
  | 'repost'
  | 'follow'
  | 'mention';

export type ChannelInteractionKindCoverage = {
  kind: ChannelInteractionKind;
  inbound: ChannelInteractionCoverageLevel;
  outbound: ChannelInteractionCoverageLevel;
  reason?: string;
};

export type FollowerPageTracking = {
  state: ChannelInteractionTrackingState;
  availability?: 'ready' | 'provisioning' | 'unavailable';
  noBackfill: true;
  trackingStartedAt?: string;
  followerSnapshotAt?: string;
  computedAt?: string;
  failureCategory?: ChannelInteractionTrackingFailureCategory;
  reason?: string;
  coverage?: ChannelInteractionKindCoverage[];
};

export type FollowerSort = {
  key: string;
  label: string;
  directions: FollowerSortDirection[];
  defaultDirection: FollowerSortDirection;
  scope?: FollowerSortScope;
  requiresWindow?: boolean;
};

export type FollowerChannel = {
  id: string;
  name: string;
  picture?: string;
  display?: string;
  identifier: string;
  sorts: FollowerSort[];
  tracking?: FollowerPageTracking;
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
  interactionCount?: number;
  interactionScore?: number;
  lastInteractionAt?: string;
};

export type ChannelInteractionDirection = 'inbound' | 'outbound';

export type FollowerMemberNoteAuthor = {
  id: string;
  name: string;
};

export type FollowerMemberNote = {
  id: string;
  content: string;
  author: FollowerMemberNoteAuthor;
  createdAt: string;
  updatedAt: string;
};

export type FollowerMemberInteraction = {
  id: string;
  kind: ChannelInteractionKind;
  direction: ChannelInteractionDirection;
  timestamp: string;
  relatedObjectId?: string;
};

export type FollowerRelationshipSnapshot = {
  snapshotAt: string;
  windowStartedAt: string;
  effortScore: number;
  reciprocationScore: number;
  reciprocity: number | null;
  grade: number | null;
  formulaVersion: number;
};

export type FollowerRelationship = {
  windowDays: 30;
  cadenceDays: 30;
  formulaVersion: 1;
  current: FollowerRelationshipSnapshot | null;
  history: FollowerRelationshipSnapshot[];
};

export type FollowerMemberDetail = {
  follower: Follower;
  notes: FollowerMemberNote[];
  interactions: FollowerMemberInteraction[];
  relationship: FollowerRelationship;
  tracking?: FollowerPageTracking;
};

export type FollowerPage = {
  items: Follower[];
  total?: number;
  nextCursor?: string;
  previousCursor?: string;
  hasMore: boolean;
  window?: ChannelInteractionWindow;
  tracking?: FollowerPageTracking;
};

export const FOLLOWER_INTERACTION_WINDOWS: {
  value: ChannelInteractionWindow;
  labelKey: string;
  defaultLabel: string;
}[] = [
  { value: 'week', labelKey: 'followers_window_week', defaultLabel: 'Week' },
  { value: 'month', labelKey: 'followers_window_month', defaultLabel: 'Month' },
  {
    value: '90_day',
    labelKey: 'followers_window_90_day',
    defaultLabel: '90 Day',
  },
  { value: 'year', labelKey: 'followers_window_year', defaultLabel: 'Year' },
];

export const DEFAULT_FOLLOWER_INTERACTION_WINDOW: ChannelInteractionWindow =
  'month';

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
  window?: ChannelInteractionWindow;
};

const buildFollowersUrl = ({
  integrationId,
  cursor,
  limit,
  sort,
  direction,
  window,
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
  if (window) {
    params.set('window', window);
  }
  return `/followers/${integrationId}?${params.toString()}`;
};

export const useFollowers = ({
  integrationId,
  cursor,
  limit,
  sort,
  direction,
  window,
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
      window,
    });
  }, [integrationId, cursor, limit, sort, direction, window]);

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

const buildFollowerDetailUrl = (
  integrationId: string,
  externalId: string
) =>
  `/followers/${integrationId}/member?externalId=${encodeURIComponent(externalId)}`;

export const useFollowerDetail = (
  integrationId?: string,
  externalId?: string
) => {
  const fetch = useFetch();

  const url = useMemo(() => {
    if (!integrationId || !externalId) {
      return null;
    }
    return buildFollowerDetailUrl(integrationId, externalId);
  }, [integrationId, externalId]);

  const load = useCallback(
    async (path: string) => {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error('Failed to load follower details');
      }
      return (await response.json()) as FollowerMemberDetail;
    },
    [fetch]
  );

  return useSWR<FollowerMemberDetail>(url, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
};

export const useFollowerNoteMutations = (
  integrationId: string,
  externalId: string,
  revalidateDetail: () => Promise<FollowerMemberDetail | undefined>
) => {
  const fetch = useFetch();

  const createNote = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) {
        throw new Error('Note content is required');
      }
      const response = await fetch(
        `/followers/${integrationId}/member/notes`,
        {
          method: 'POST',
          body: JSON.stringify({ externalId, content: trimmed }),
        }
      );
      if (!response.ok) {
        throw new Error('Failed to create note');
      }
      await revalidateDetail();
      return (await response.json()) as FollowerMemberNote;
    },
    [externalId, fetch, integrationId, revalidateDetail]
  );

  const updateNote = useCallback(
    async (noteId: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) {
        throw new Error('Note content is required');
      }
      const response = await fetch(
        `/followers/${integrationId}/member/notes/${noteId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ content: trimmed }),
        }
      );
      if (!response.ok) {
        throw new Error('Failed to update note');
      }
      await revalidateDetail();
    },
    [fetch, integrationId, revalidateDetail]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      const response = await fetch(
        `/followers/${integrationId}/member/notes/${noteId}`,
        {
          method: 'DELETE',
        }
      );
      if (!response.ok) {
        throw new Error('Failed to delete note');
      }
      await revalidateDetail();
    },
    [fetch, integrationId, revalidateDetail]
  );

  return { createNote, updateNote, deleteNote };
};
