/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useAgentSkills } from './use.agent.skills';

const fetchMock = jest.fn();

jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => fetchMock,
}));

describe('useAgentSkills', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('throws parsed API errors for non-2xx catalog responses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Catalog unavailable' }),
    });

    const { result } = renderHook(() => useAgentSkills());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.error?.message).toBe('Catalog unavailable');
    expect(result.current.data).toEqual([]);
  });

  it('returns catalog data for successful responses', async () => {
    const catalog = [
      {
        id: 'campaign',
        slug: 'campaign',
        command: '/campaign',
        name: 'campaign.skill.md',
        fileSize: 100,
        updatedAt: '2026-01-01',
        isLarge: false,
      },
    ];
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => catalog,
    });

    const { result } = renderHook(() => useAgentSkills());

    await waitFor(() => {
      expect(result.current.data).toEqual(catalog);
    });

    expect(result.current.error).toBeUndefined();
  });
});
