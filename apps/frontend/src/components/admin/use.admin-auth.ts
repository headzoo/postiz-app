'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface AdminAuthStatus {
  enrolled: boolean;
  verified: boolean;
  fresh: boolean;
  expiresAt: string | null;
  freshUntil: string | null;
}

export const useAdminAuthStatus = () => {
  const fetch = useFetch();

  return useSWR<AdminAuthStatus>(
    '/admin-auth/status',
    async (path: string) => {
      const response = await fetch(path);

      if (!response.ok) {
        throw new Error('Unable to load admin passkey status');
      }

      return response.json();
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );
};
