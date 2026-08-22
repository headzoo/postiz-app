/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useRulesList } from './use.rules.list';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

jest.mock('@gitroom/helpers/utils/custom.fetch');

const mockFetch = useFetch as jest.MockedFunction<typeof useFetch>;

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    SWRConfig,
    { value: { provider: () => new Map() } },
    children
  );

describe('useRulesList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load rules list successfully', async () => {
    const mockRules = [
      {
        id: 'rule-1',
        name: 'Test Rule',
        enabled: true,
        action: 'REMOVE' as const,
        initialDelayHours: 24,
        evaluationIntervalHours: null,
        maxEvaluations: null,
        conditionMatch: 'ANY' as const,
        conditions: [],
        integrationIds: ['int-1', 'int-2'],
        integrationCount: 2,
        pipelineCount: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockRules),
    });

    mockFetch.mockReturnValue(fetchMock);

    const { result } = renderHook(() => useRulesList(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockRules);
    });

    expect(fetchMock).toHaveBeenCalledWith('/rules');
  });

  it('should return empty array as fallback', () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue([]),
    });

    mockFetch.mockReturnValue(fetchMock);

    const { result } = renderHook(() => useRulesList(), { wrapper });

    expect(result.current.data).toEqual([]);
  });
});
