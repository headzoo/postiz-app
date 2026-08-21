/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminScheduleComponent } from './admin-schedule.component';

const mockUseSWR = jest.fn();
const mockMutate = jest.fn();
const mockFetch = jest.fn();

jest.mock('swr', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => mockFetch,
}));

jest.mock('@gitroom/frontend/components/layout/user.context', () => ({
  useUser: () => ({ isSuperAdmin: true }),
}));

jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (key: string, fallback: string) => fallback,
}));

jest.mock('@gitroom/frontend/components/layout/loading', () => ({
  LoadingComponent: () => <div>Loading</div>,
}));

const scheduleByKey: Record<string, unknown> = {
  '/admin/schedule/relationship-grades': {
    scheduleId: 'channel-relationship-grade-schedule-v1',
    exists: true,
    paused: false,
    cadence: { unit: 'day', interval: 3, timeOfDay: '00:00' },
    nextRunTimes: ['2026-08-22T00:00:00.000Z'],
  },
  '/admin/schedule/follower-bot-scores': {
    scheduleId: 'channel-follower-bot-score-schedule-v1',
    exists: true,
    paused: false,
    cadence: { intervalHours: 6 },
    nextRunTimes: ['2026-08-21T12:00:00.000Z'],
  },
  '/admin/schedule/missing-post-recovery': {
    workflowId: 'missing-post-workflow',
    exists: true,
    status: 'RUNNING',
    cadence: {
      unit: 'hour',
      interval: 1,
      label: 'Every hour (fixed in workflow)',
    },
  },
  '/admin/schedule/post-workflows': {
    workflowId: 'pipeline-scheduler-workflow-v2',
    exists: true,
    status: 'RUNNING',
    cadence: {
      unit: 'second',
      interval: 30,
      label: 'Every 30 seconds (fixed in workflow)',
    },
  },
  '/admin/schedule/autopost-workflows': {
    workflowId: 'autopost-workflows',
    exists: true,
    status: 'ACTIVE_CONFIGS',
    cadence: {
      unit: 'hour',
      interval: 1,
      label: 'Every hour per active autopost (fixed in workflow)',
    },
    activeCount: 2,
  },
};

describe('AdminScheduleComponent', () => {
  beforeEach(() => {
    mockUseSWR.mockReset();
    mockMutate.mockReset();
    mockFetch.mockReset();
    mockUseSWR.mockImplementation((key: string) => ({
      data: scheduleByKey[key],
      isLoading: false,
      mutate: mockMutate,
    }));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ exists: true }),
    });
  });

  it('renders the current relationship grade schedule', () => {
    render(<AdminScheduleComponent />);

    expect(screen.getByText('Relationship grades')).toBeTruthy();
    expect(screen.getByText('Every 3 days at 00:00 UTC')).toBeTruthy();
    expect(screen.getAllByText(/Next run/).length).toBeGreaterThan(0);
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/admin/schedule/relationship-grades',
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('saves a new cadence', async () => {
    render(<AdminScheduleComponent />);

    fireEvent.change(screen.getByLabelText('Repeat'), {
      target: { value: 'hour' },
    });
    fireEvent.change(screen.getByLabelText('Interval'), {
      target: { value: '1' },
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/admin/schedule/relationship-grades',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ unit: 'hour', interval: 1 }),
        })
      );
    });
    expect(mockMutate).toHaveBeenCalled();
  });

  it('triggers the Temporal schedule immediately', async () => {
    render(<AdminScheduleComponent />);

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Trigger now' })[0]);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/admin/schedule/relationship-grades/trigger',
        { method: 'POST' }
      );
    });
  });

  it('renders and updates follower bot score schedule', async () => {
    render(<AdminScheduleComponent />);

    expect(screen.getByText('Follower bot scores')).toBeTruthy();
    expect(screen.getByText('Every 6 hours')).toBeTruthy();
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/admin/schedule/follower-bot-scores',
      expect.any(Function),
      expect.any(Object)
    );

    fireEvent.change(screen.getByLabelText('Interval (hours)'), {
      target: { value: '3' },
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[1]);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/admin/schedule/follower-bot-scores',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ intervalHours: 3 }),
        })
      );
    });
  });

  it('triggers missing post recovery, post workflows, and autoposts', async () => {
    render(<AdminScheduleComponent />);

    expect(screen.getByText('Missing post recovery')).toBeTruthy();
    expect(screen.getByText('Post workflows')).toBeTruthy();
    expect(screen.getByText('Autopost workflows')).toBeTruthy();
    expect(screen.getByText(/Active autoposts/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Trigger scan now' }));
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Trigger scheduler tick now' })
      );
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Force run all active' })
      );
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/admin/schedule/missing-post-recovery/trigger',
        { method: 'POST' }
      );
      expect(mockFetch).toHaveBeenCalledWith(
        '/admin/schedule/post-workflows/trigger',
        { method: 'POST' }
      );
      expect(mockFetch).toHaveBeenCalledWith(
        '/admin/schedule/autopost-workflows/trigger',
        { method: 'POST' }
      );
    });
  });
});
