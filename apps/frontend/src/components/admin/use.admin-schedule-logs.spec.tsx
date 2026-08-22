/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import React from 'react';
import { renderHook } from '@testing-library/react';
import { useAdminScheduleLogs } from './use.admin-schedule-logs';

const mockUseSWR = jest.fn();
const mockFetch = jest.fn();

jest.mock('swr', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => mockFetch,
}));

describe('useAdminScheduleLogs', () => {
  beforeEach(() => {
    mockUseSWR.mockReset();
    mockFetch.mockReset();
    mockUseSWR.mockReturnValue({ data: { items: [] }, isLoading: false });
  });

  it('polls schedule logs every 2 seconds for the given key', () => {
    renderHook(() => useAdminScheduleLogs('lead-bridge'));

    expect(mockUseSWR).toHaveBeenCalledWith(
      '/admin/schedule/logs?key=lead-bridge&limit=100',
      expect.any(Function),
      expect.objectContaining({
        refreshInterval: 2000,
        revalidateOnFocus: false,
      })
    );
  });
});
