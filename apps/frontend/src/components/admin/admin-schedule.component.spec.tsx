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

describe('AdminScheduleComponent', () => {
  beforeEach(() => {
    mockUseSWR.mockReset();
    mockMutate.mockReset();
    mockFetch.mockReset();
    mockUseSWR.mockReturnValue({
      data: {
        scheduleId: 'channel-relationship-grade-schedule-v1',
        exists: true,
        paused: false,
        cadence: { unit: 'day', interval: 3, timeOfDay: '00:00' },
        nextRunTimes: ['2026-08-22T00:00:00.000Z'],
      },
      isLoading: false,
      mutate: mockMutate,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ exists: true }),
    });
  });

  it('renders the current relationship grade schedule', () => {
    render(<AdminScheduleComponent />);

    expect(screen.getByText('Relationship grades')).toBeTruthy();
    expect(screen.getByText('Every 3 days at 00:00 UTC')).toBeTruthy();
    expect(screen.getByText(/Next run/)).toBeTruthy();
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
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
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
      fireEvent.click(screen.getByRole('button', { name: 'Trigger now' }));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/admin/schedule/relationship-grades/trigger',
        { method: 'POST' }
      );
    });
  });
});
