'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';

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

export type RelationshipTriage =
  | 'quiet'
  | 'hot_lead'
  | 'over_invested'
  | 'mutual';

export type DismissibleTriage =
  | RelationshipTriage
  | 'lead';

export type FollowerTriageFilter =
  | 'engaged_not_yet'
  | 'hot_lead'
  | 'mutual'
  | 'over_invested'
  | 'quiet';

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
  failedSubscriptions?: {
    eventKey: string;
    direction: string;
    reason?: string;
  }[];
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
  noteCount?: number;
  likesCount?: number;
  relationshipGrade?: number | null;
  effortScore?: number | null;
  reciprocationScore?: number | null;
  netGap?: number | null;
  effortStars?: number | null;
  reciprocationStars?: number | null;
  relationshipTriage?: RelationshipTriage | null;
  relationshipFormulaVersion?: number | null;
  relationshipSnapshotAt?: string | null;
  myGrade?: number | null;
  adjustedGrade?: number | null;
  listIds?: string[];
  isLead?: boolean;
};

export type FollowerList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
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
  adjustedGrade: number | null;
  effortStars: number;
  reciprocationStars: number;
  triage: RelationshipTriage | null;
  formulaVersion: number;
};

export type FollowerRelationship = {
  windowDays: 30;
  cadenceDays: 3;
  formulaVersion: number;
  current: FollowerRelationshipSnapshot | null;
  history: FollowerRelationshipSnapshot[];
};

export type FollowerMemberDetail = {
  follower: Follower;
  notes: FollowerMemberNote[];
  interactions: FollowerMemberInteraction[];
  relationship: FollowerRelationship;
  myGrade: number | null;
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
  search?: string;
  triage?: FollowerTriageFilter;
  audience?: 'lead';
  listId?: string;
};

export const buildFollowersUrl = ({
  integrationId,
  cursor,
  limit,
  sort,
  direction,
  window,
  search,
  triage,
  audience,
  listId,
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
  if (search) {
    params.set('search', search);
  }
  if (triage) {
    params.set('triage', triage);
  }
  if (audience) {
    params.set('audience', audience);
  }
  if (listId) {
    params.set('listId', listId);
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
  search,
  triage,
  audience,
  listId,
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
      search,
      triage,
      audience,
      listId,
    });
  }, [
    integrationId,
    cursor,
    limit,
    sort,
    direction,
    window,
    search,
    triage,
    audience,
    listId,
  ]);

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

export const useFollowerGradeMutation = (
  integrationId: string,
  externalId: string,
  revalidateDetail: () => Promise<FollowerMemberDetail | undefined>
) => {
  const fetch = useFetch();

  const updateGrade = useCallback(
    async (grade: number) => {
      const response = await fetch(
        `/followers/${integrationId}/member/my-grade`,
        {
          method: 'PUT',
          body: JSON.stringify({ externalId, grade }),
        }
      );
      if (!response.ok) {
        throw new Error('Failed to update personal grade');
      }
      await revalidateDetail();
    },
    [externalId, fetch, integrationId, revalidateDetail]
  );

  return { updateGrade };
};

export type RelationshipScoreDirection = 'their' | 'your';

export const isFollowerListCacheKey = (
  integrationId: string,
  key: unknown
) =>
  typeof key === 'string' && key.startsWith(`/followers/${integrationId}?`);

const isRelationshipSnapshot = (
  value: unknown
): value is FollowerRelationshipSnapshot => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const snapshot = value as Partial<FollowerRelationshipSnapshot>;
  return (
    Number.isSafeInteger(snapshot.effortScore) &&
    Number.isSafeInteger(snapshot.reciprocationScore) &&
    Number.isFinite(snapshot.effortStars) &&
    Number.isFinite(snapshot.reciprocationStars)
  );
};

export const applyRelationshipSnapshotToFollowerPage = (
  page: FollowerPage | undefined,
  externalId: string,
  current: unknown
): FollowerPage | undefined => {
  if (!page || !isRelationshipSnapshot(current)) {
    return page;
  }
  return {
    ...page,
    items: page.items.map((item) =>
      item.id !== externalId
        ? item
        : {
          ...item,
          effortScore: current.effortScore,
          reciprocationScore: current.reciprocationScore,
          netGap: current.reciprocationScore - current.effortScore,
          effortStars: current.effortStars,
          reciprocationStars: current.reciprocationStars,
          relationshipGrade: current.grade,
          relationshipTriage: current.triage,
          relationshipFormulaVersion: current.formulaVersion,
          relationshipSnapshotAt: current.snapshotAt,
          adjustedGrade: current.adjustedGrade,
        }
    ),
  };
};

export const useFollowerRelationshipScoreMutation = (
  integrationId: string,
  externalId: string,
  revalidateDetail: () => Promise<FollowerMemberDetail | undefined>
) => {
  const fetch = useFetch();
  const { mutate: mutateCache } = useSWRConfig();

  const refreshScore = useCallback(
    async (direction: RelationshipScoreDirection) => {
      const response = await fetch(
        `/followers/${integrationId}/member/relationship-score`,
        {
          method: 'POST',
          body: JSON.stringify({ externalId, direction }),
        }
      );
      if (!response.ok) {
        throw new Error('Failed to refresh relationship score');
      }
      const current = (await response.json()) as FollowerRelationshipSnapshot;
      await Promise.all([
        revalidateDetail(),
        mutateCache(
          (key) => isFollowerListCacheKey(integrationId, key),
          (page: FollowerPage | undefined) =>
            applyRelationshipSnapshotToFollowerPage(page, externalId, current),
          { revalidate: true }
        ),
      ]);
    },
    [externalId, fetch, integrationId, mutateCache, revalidateDetail]
  );

  return { refreshScore };
};

export const followerListsKey = (integrationId: string) =>
  `/followers/${integrationId}/lists`;

export const useFollowerLists = (integrationId?: string) => {
  const fetch = useFetch();

  const url = useMemo(() => {
    if (!integrationId) {
      return null;
    }
    return followerListsKey(integrationId);
  }, [integrationId]);

  const load = useCallback(
    async (path: string) => {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error('Failed to load follower lists');
      }
      return (await response.json()) as FollowerList[];
    },
    [fetch]
  );

  return useSWR<FollowerList[]>(url, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });
};

export const applyListMembershipToFollowerPage = (
  page: FollowerPage | undefined,
  externalId: string,
  listId: string,
  assigned: boolean
): FollowerPage | undefined => {
  if (!page) {
    return page;
  }
  return {
    ...page,
    items: page.items.map((item) => {
      if (item.id !== externalId) {
        return item;
      }
      const current = item.listIds ?? [];
      const listIds = assigned
        ? current.includes(listId)
          ? current
          : [...current, listId]
        : current.filter((id) => id !== listId);
      return { ...item, listIds };
    }),
  };
};

export const applyTriageIgnoreToFollowerPage = (
  page: FollowerPage | undefined,
  externalId: string,
  options?: { removeFromPage?: boolean; triage?: DismissibleTriage }
): FollowerPage | undefined => {
  if (!page) {
    return page;
  }
  const items = options?.removeFromPage
    ? page.items.filter((item) => item.id !== externalId)
    : page.items.map((item) => {
        if (item.id !== externalId) {
          return item;
        }
        if (options?.triage === 'lead') {
          return { ...item, isLead: false };
        }
        return { ...item, relationshipTriage: null };
      });
  return {
    ...page,
    items,
  };
};

export const useFollowerListMutations = (integrationId?: string) => {
  const fetch = useFetch();
  const { mutate: mutateCache } = useSWRConfig();

  const revalidateLists = useCallback(async () => {
    if (!integrationId) {
      return;
    }
    await mutateCache(followerListsKey(integrationId));
  }, [integrationId, mutateCache]);

  const createList = useCallback(
    async (name: string) => {
      if (!integrationId) {
        throw new Error('Channel is required');
      }
      const response = await fetch(`/followers/${integrationId}/lists`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error('Failed to create follower list');
      }
      const list = (await response.json()) as FollowerList;
      await mutateCache(
        followerListsKey(integrationId),
        (current: FollowerList[] | undefined) => {
          const lists = current ?? [];
          if (lists.some((item) => item.id === list.id)) {
            return lists;
          }
          return [...lists, list];
        },
        { revalidate: true }
      );
      return list;
    },
    [fetch, integrationId, mutateCache]
  );

  const addMember = useCallback(
    async (listId: string, externalId: string) => {
      if (!integrationId) {
        throw new Error('Channel is required');
      }
      const response = await fetch(
        `/followers/${integrationId}/lists/${listId}/members`,
        {
          method: 'POST',
          body: JSON.stringify({ externalId }),
        }
      );
      if (!response.ok) {
        throw new Error('Failed to add follower to list');
      }
      await mutateCache(
        (key) => isFollowerListCacheKey(integrationId, key),
        (page: FollowerPage | undefined) =>
          applyListMembershipToFollowerPage(page, externalId, listId, true),
        { revalidate: true }
      );
    },
    [fetch, integrationId, mutateCache]
  );

  const removeMember = useCallback(
    async (listId: string, externalId: string) => {
      if (!integrationId) {
        throw new Error('Channel is required');
      }
      const response = await fetch(
        `/followers/${integrationId}/lists/${listId}/members`,
        {
          method: 'DELETE',
          body: JSON.stringify({ externalId }),
        }
      );
      if (!response.ok) {
        throw new Error('Failed to remove follower from list');
      }
      await mutateCache(
        (key) => isFollowerListCacheKey(integrationId, key),
        (page: FollowerPage | undefined) =>
          applyListMembershipToFollowerPage(page, externalId, listId, false),
        { revalidate: true }
      );
    },
    [fetch, integrationId, mutateCache]
  );

  const ignoreTriage = useCallback(
    async (externalId: string, triage: DismissibleTriage) => {
      if (!integrationId) {
        throw new Error('Channel is required');
      }
      const response = await fetch(
        `/followers/${integrationId}/member/triage-ignore`,
        {
          method: 'POST',
          body: JSON.stringify({ externalId, triage }),
        }
      );
      if (!response.ok) {
        throw new Error('Failed to remove triage badge');
      }
      await mutateCache(
        (key) => isFollowerListCacheKey(integrationId, key),
        (page: FollowerPage | undefined) =>
          applyTriageIgnoreToFollowerPage(page, externalId, { triage }),
        { revalidate: true }
      );
    },
    [fetch, integrationId, mutateCache]
  );

  return { createList, addMember, removeMember, ignoreTriage, revalidateLists };
};

