/**
 * @jest-environment ./jest.jsdom.environment.js
 */

jest.mock('chart.js/auto', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
  })),
}));

import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { FollowerDetailModal } from './follower.detail.modal';
import { FollowerMemberDetail } from './use.followers';

jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: jest.fn(),
}));

jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (key: string, fallback: string, params?: Record<string, unknown>) => {
    if (!params) {
      return fallback;
    }
    return Object.entries(params).reduce(
      (result, [name, value]) =>
        result.replace(new RegExp(`{{${name}}}`, 'g'), String(value)),
      fallback
    );
  },
}));

jest.mock('@gitroom/frontend/components/layout/loading', () => ({
  LoadingComponent: () => <div data-testid="loading">Loading</div>,
}));

jest.mock('@gitroom/react/helpers/image.with.fallback', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const decisionOpen = jest.fn().mockResolvedValue(true);

jest.mock('@gitroom/frontend/components/layout/new-modal', () => ({
  useDecisionModal: () => ({ open: decisionOpen }),
}));

const useSWR = jest.requireMock('swr').default as jest.Mock;
const { useFetch } = jest.requireMock(
  '@gitroom/helpers/utils/custom.fetch'
) as { useFetch: jest.Mock };

const detail: FollowerMemberDetail = {
  follower: {
    id: 'follower-1',
    name: 'Alex Example',
    username: 'alex',
    profileUrl: 'https://example.com/alex',
    bio: 'Builder',
    followersCount: 1200,
    followingCount: 300,
  },
  notes: [
    {
      id: 'note-1',
      content: 'Existing note',
      author: { id: 'user-1', name: 'Taylor' },
      createdAt: '2026-01-01T12:00:00.000Z',
      updatedAt: '2026-01-01T12:00:00.000Z',
    },
  ],
  interactions: [
    {
      id: 'event-1',
      kind: 'like',
      direction: 'outbound',
      timestamp: '2026-01-02T12:00:00.000Z',
    },
  ],
  relationship: {
    windowDays: 30,
    cadenceDays: 30,
    formulaVersion: 1,
    current: {
      snapshotAt: '2026-02-01T00:00:00.000Z',
      windowStartedAt: '2026-01-02T00:00:00.000Z',
      effortScore: 10,
      reciprocationScore: 5,
      reciprocity: 0.5,
      grade: 3.5,
      formulaVersion: 1,
    },
    history: [
      {
        snapshotAt: '2026-01-01T00:00:00.000Z',
        windowStartedAt: '2025-12-02T00:00:00.000Z',
        effortScore: 0,
        reciprocationScore: 0,
        reciprocity: null,
        grade: null,
        formulaVersion: 1,
      },
      {
        snapshotAt: '2026-02-01T00:00:00.000Z',
        windowStartedAt: '2026-01-02T00:00:00.000Z',
        effortScore: 10,
        reciprocationScore: 5,
        reciprocity: 0.5,
        grade: 3.5,
        formulaVersion: 1,
      },
    ],
  },
  tracking: {
    state: 'partial',
    noBackfill: true,
    trackingStartedAt: '2026-01-01T00:00:00.000Z',
    coverage: [
      {
        kind: 'repost',
        inbound: 'partial',
        outbound: 'supported',
        reason: 'Inbound reposts are partially tracked',
      },
    ],
  },
};

describe('FollowerDetailModal', () => {
  const mutate = jest.fn().mockResolvedValue(detail);
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useFetch.mockReturnValue(fetchMock);
    decisionOpen.mockResolvedValue(true);
    useSWR.mockReturnValue({
      data: detail,
      error: undefined,
      isLoading: false,
      mutate,
    });
    fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            id: 'note-2',
            content: 'New note',
            author: { id: 'user-2', name: 'Sam' },
            createdAt: '2026-02-02T12:00:00.000Z',
            updatedAt: '2026-02-02T12:00:00.000Z',
          }),
        };
      }
      if (options?.method === 'PUT') {
        return { ok: true, json: async () => ({}) };
      }
      if (options?.method === 'DELETE') {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: true, json: async () => detail };
    });
  });

  it('shows loading and error states', () => {
    useSWR.mockReturnValueOnce({
      data: undefined,
      error: undefined,
      isLoading: true,
      mutate,
    });
    const { rerender } = render(
      <FollowerDetailModal integrationId="channel-1" externalId="follower-1" />
    );
    expect(screen.getByTestId('loading')).toBeTruthy();

    useSWR.mockReturnValueOnce({
      data: undefined,
      error: new Error('failed'),
      isLoading: false,
      mutate,
    });
    rerender(
      <FollowerDetailModal integrationId="channel-1" externalId="follower-1" />
    );
    expect(
      screen.getByText('We could not load this follower right now.')
    ).toBeTruthy();
  });

  it('renders relationship grade, E/R metrics, and accessible star text', () => {
    render(
      <FollowerDetailModal integrationId="channel-1" externalId="follower-1" />
    );

    expect(screen.getByText('Relationship grade')).toBeTruthy();
    expect(screen.getByLabelText('3.5 out of 5')).toBeTruthy();
    expect(screen.getByText('Your effort (E): 10')).toBeTruthy();
    expect(screen.getByText('Their reciprocation (R): 5')).toBeTruthy();
    expect(screen.getByText('Reciprocity: 50%')).toBeTruthy();
  });

  it('renders accessible grade history for every snapshot', () => {
    render(
      <FollowerDetailModal integrationId="channel-1" externalId="follower-1" />
    );

    const table = screen.getByRole('table', { name: 'Grade history' });
    const rows = within(table).getAllByRole('row');

    expect(rows).toHaveLength(3);
    expect(
      screen.getByText('No grade (not enough tracked activity)')
    ).toBeTruthy();
    expect(screen.getByText('3.5')).toBeTruthy();
  });

  it('shows no-backfill and partial coverage caveats', () => {
    render(
      <FollowerDetailModal integrationId="channel-1" externalId="follower-1" />
    );

    expect(
      screen.getByText(/Earlier provider activity is not backfilled/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/Grades may be incomplete/i)
    ).toBeTruthy();
    expect(
      screen.getByText('Inbound reposts are partially tracked')
    ).toBeTruthy();
  });

  it('creates notes and revalidates detail', async () => {
    render(
      <FollowerDetailModal integrationId="channel-1" externalId="follower-1" />
    );

    const newNoteInput = document.querySelector(
      'textarea[name="follower-new-note"]'
    ) as HTMLTextAreaElement;
    fireEvent.change(newNoteInput, {
      target: { value: 'New note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/followers/channel-1/member/notes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            externalId: 'follower-1',
            content: 'New note',
          }),
        })
      );
      expect(mutate).toHaveBeenCalled();
    });
  });

  it('updates and deletes notes with detail revalidation', async () => {
    render(
      <FollowerDetailModal integrationId="channel-1" externalId="follower-1" />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue('Existing note'), {
      target: { value: 'Updated note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/followers/channel-1/member/notes/note-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ content: 'Updated note' }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(decisionOpen).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        '/followers/channel-1/member/notes/note-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  it('shows empty stars when no grade exists', () => {
    useSWR.mockReturnValue({
      data: {
        ...detail,
        relationship: {
          ...detail.relationship,
          current: null,
          history: [],
        },
        tracking: {
          state: 'unsupported',
          noBackfill: true,
          coverage: [],
        },
      },
      error: undefined,
      isLoading: false,
      mutate,
    });

    render(
      <FollowerDetailModal integrationId="channel-1" externalId="follower-1" />
    );

    expect(screen.getByRole('img', { name: 'No grade yet' })).toBeTruthy();
    expect(screen.queryByText('Not enough tracked activity')).toBeNull();
    expect(
      screen.queryByText(/does not support interaction tracking/i)
    ).toBeNull();
  });

  it('shows empty stars when current grade is null', () => {
    useSWR.mockReturnValue({
      data: {
        ...detail,
        relationship: {
          ...detail.relationship,
          current: {
            ...detail.relationship.current!,
            grade: null,
            reciprocity: null,
          },
        },
      },
      error: undefined,
      isLoading: false,
      mutate,
    });

    render(
      <FollowerDetailModal integrationId="channel-1" externalId="follower-1" />
    );

    expect(screen.getByRole('img', { name: 'No grade yet' })).toBeTruthy();
    expect(screen.queryByText('Not enough tracked activity')).toBeNull();
  });

  it('preserves note draft after a failed save', async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false }));

    render(
      <FollowerDetailModal integrationId="channel-1" externalId="follower-1" />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue('Existing note'), {
      target: { value: 'Broken save' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(
        screen.getByText('Could not save this note. Try again.')
      ).toBeTruthy();
    });
    expect(screen.getByDisplayValue('Broken save')).toBeTruthy();
  });
});
