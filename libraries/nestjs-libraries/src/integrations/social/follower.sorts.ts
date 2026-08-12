import {
  Follower,
  FollowerSort,
  FollowerSortDirection,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

export const FOLLOWER_NATIVE_RECENT_SORT: FollowerSort = {
  key: 'recent',
  label: 'Recent',
  directions: ['desc'],
  defaultDirection: 'desc',
  scope: 'native',
};

export const FOLLOWER_PAGE_SORTS: FollowerSort[] = [
  {
    key: 'followers_count',
    label: 'Followers',
    directions: ['asc', 'desc'],
    defaultDirection: 'desc',
    scope: 'page',
  },
  {
    key: 'following_count',
    label: 'Following',
    directions: ['asc', 'desc'],
    defaultDirection: 'desc',
    scope: 'page',
  },
  {
    key: 'account_created_at',
    label: 'Joined',
    directions: ['asc', 'desc'],
    defaultDirection: 'desc',
    scope: 'page',
  },
  {
    key: 'name',
    label: 'Name',
    directions: ['asc', 'desc'],
    defaultDirection: 'asc',
    scope: 'page',
  },
];

export const API_ORDER_FOLLOWER_SORTS: FollowerSort[] = [
  FOLLOWER_NATIVE_RECENT_SORT,
  ...FOLLOWER_PAGE_SORTS,
];

export const isPageScopedFollowerSort = (
  sorts: FollowerSort[] | undefined,
  key?: string
) => {
  if (!key) {
    return false;
  }

  const sort = sorts?.find((candidate) => candidate.key === key);
  return sort?.scope === 'page';
};

const compareValues = (
  left: number | string | undefined,
  right: number | string | undefined
) => {
  if (left === undefined && right === undefined) {
    return 0;
  }
  if (left === undefined) {
    return 1;
  }
  if (right === undefined) {
    return -1;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return String(left).localeCompare(String(right), undefined, {
    sensitivity: 'base',
  });
};

export const compareFollowers = (
  left: Follower,
  right: Follower,
  key: string,
  direction: FollowerSortDirection
) => {
  const factor = direction === 'asc' ? 1 : -1;

  switch (key) {
    case 'followers_count':
      return factor * compareValues(left.followersCount, right.followersCount);
    case 'following_count':
      return factor * compareValues(left.followingCount, right.followingCount);
    case 'account_created_at':
      return (
        factor * compareValues(left.accountCreatedAt, right.accountCreatedAt)
      );
    case 'name':
      return factor * compareValues(left.name, right.name);
    default:
      return 0;
  }
};

export const sortFollowers = (
  items: Follower[],
  key: string,
  direction: FollowerSortDirection
) => [...items].sort((left, right) => compareFollowers(left, right, key, direction));
