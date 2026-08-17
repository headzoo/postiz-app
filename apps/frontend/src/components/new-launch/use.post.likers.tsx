'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export type PostLiker = {
  id: string;
  name: string;
  username?: string;
  picture?: string;
  profileUrl?: string;
};

export type PostLikersResponse =
  | { supported: false }
  | { supported: true; users: PostLiker[]; error?: string };

export const usePostLikers = (postId?: string | null) => {
  const fetch = useFetch();

  const load = useCallback(
    async (path: string) => {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error('Failed to load likers');
      }
      return (await response.json()) as PostLikersResponse;
    },
    [fetch]
  );

  return useSWR<PostLikersResponse>(
    postId ? `/posts/${postId}/likers` : null,
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
