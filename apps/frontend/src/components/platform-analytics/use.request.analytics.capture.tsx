'use client';

import { useCallback, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export type AnalyticsCaptureStatus = 'queued' | 'already_queued';

export type AnalyticsCaptureResponse = {
  status: AnalyticsCaptureStatus;
  message: string;
};

export const useRequestAnalyticsCapture = (integrationId?: string) => {
  const fetch = useFetch();
  const [isRequesting, setIsRequesting] = useState(false);

  const requestCapture = useCallback(async () => {
    if (!integrationId) {
      throw new Error('Integration is required');
    }
    setIsRequesting(true);
    try {
      const response = await fetch(`/analytics/${integrationId}/capture`, {
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body?.message === 'string'
            ? body.message
            : 'Unable to start analytics collection'
        );
      }
      return body as AnalyticsCaptureResponse;
    } finally {
      setIsRequesting(false);
    }
  }, [fetch, integrationId]);

  return { requestCapture, isRequesting };
};
