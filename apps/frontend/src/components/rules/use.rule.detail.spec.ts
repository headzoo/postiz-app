/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useRuleDetail } from './use.rule.detail';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

jest.mock('@gitroom/helpers/utils/custom.fetch');

const mockFetch = useFetch as jest.MockedFunction<typeof useFetch>;

describe('useRuleDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load rule detail successfully', async () => {
    const mockRule = {
      id: 'rule-1',
      name: 'Test Rule',
      enabled: true,
      action: 'REMOVE' as const,
      initialDelayHours: 24,
      evaluationIntervalHours: null,
      maxEvaluations: null,
      conditionMatch: 'ANY' as const,
      conditions: [],
      actionConfig: {},
      rescheduleConfig: null,
      maxRescheduleAttempts: null,
      integrationIds: ['int-1'],
      pipelineIds: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockRule),
    });

    mockFetch.mockReturnValue(fetchMock);

    const { result } = renderHook(() => useRuleDetail('rule-1'));

    await waitFor(() => {
      expect(result.current.data).toEqual(mockRule);
    });

    expect(fetchMock).toHaveBeenCalledWith('/rules/rule-1');
  });

  it('should not fetch when id is undefined', () => {
    const fetchMock = jest.fn();
    mockFetch.mockReturnValue(fetchMock);

    renderHook(() => useRuleDetail(undefined));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
