'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback } from 'react';
import useSWR from 'swr';
import {
  ChannelInteractionTrackingFailureCategory,
  FollowerPageTracking,
} from '@gitroom/frontend/components/followers/use.followers';

export type ChannelSubscriptionDetail = {
  eventKey: string;
  direction: string;
  state: string;
  remoteIdentifier?: string;
  failureCategory?: ChannelInteractionTrackingFailureCategory;
  reason?: string;
  trackingStartedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ChannelDetails = {
  id: string;
  name: string;
  picture?: string;
  display?: string;
  identifier: string;
  internalId: string;
  type: string;
  disabled: boolean;
  refreshNeeded: boolean;
  inBetweenSteps: boolean;
  deleted?: boolean;
  profileUrl?: string;
  tracking: FollowerPageTracking;
  subscriptions: ChannelSubscriptionDetail[];
};

export const useChannelDetails = (integrationId?: string) => {
  const fetch = useFetch();

  const load = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Failed to load channel details');
    }
    return (await response.json()) as ChannelDetails;
  }, [fetch]);

  return useSWR<ChannelDetails>(
    integrationId ? `/integrations/${integrationId}/channel-details` : null,
    load,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
    }
  );
};
