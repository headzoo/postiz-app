/**
 * @jest-environment ./jest.jsdom.environment.js
 */

jest.mock('chart.js/auto', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
  })),
}));

jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (key: string, fallback: string) => fallback,
}));

jest.mock('@gitroom/frontend/components/analytics/chart-social', () => ({
  ChartSocial: () => <div data-testid="chart-social" />,
  sortAnalyticsPoints: (data: Array<{ date: string; total: number }>) =>
    [...data].sort((a, b) => a.date.localeCompare(b.date)),
}));

const usePlatformAnalytics = jest.fn();

jest.mock(
  '@gitroom/frontend/components/platform-analytics/use.platform.analytics',
  () => ({
    usePlatformAnalytics: (...args: unknown[]) => usePlatformAnalytics(...args),
  })
);

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  AnalyticsCard,
  analyticsTotal,
  formatAnalyticsValue,
  RenderAnalytics,
  resolveDisplayUnit,
  resolveValueMode,
} from './render.analytics';

describe('resolveValueMode', () => {
  it('prefers valueMode over legacy average flag', () => {
    expect(
      resolveValueMode({
        label: 'Impressions',
        data: [],
        valueMode: 'latest',
        average: true,
      })
    ).toBe('latest');
  });

  it('falls back to average when only legacy average is present', () => {
    expect(
      resolveValueMode({
        label: 'Engagement',
        data: [],
        average: true,
      })
    ).toBe('average');
  });
});

describe('analyticsTotal', () => {
  it('sums points for sum mode', () => {
    expect(
      analyticsTotal({
        label: 'Impressions',
        valueMode: 'sum',
        data: [
          { date: '2026-08-01', total: 10 },
          { date: '2026-08-02', total: 15 },
        ],
      })
    ).toBe('25');
  });

  it('averages points for average percentage mode', () => {
    expect(
      analyticsTotal({
        label: 'Engagement rate',
        valueMode: 'average',
        displayUnit: 'percentage',
        data: [
          { date: '2026-08-01', total: 10 },
          { date: '2026-08-02', total: 20 },
        ],
      })
    ).toBe('15.00%');
  });

  it('averages duration metrics without a percent suffix', () => {
    expect(
      analyticsTotal({
        label: 'Average View Duration',
        valueMode: 'average',
        displayUnit: 'duration',
        data: [
          { date: '2026-08-01', total: 45 },
          { date: '2026-08-02', total: 75 },
        ],
      })
    ).toBe('1:00');
  });

  it('formats duration values as mm:ss or seconds', () => {
    expect(formatAnalyticsValue(45, 'duration')).toBe('45s');
    expect(formatAnalyticsValue(90, 'duration')).toBe('1:30');
  });

  it('uses the latest sorted point for latest mode', () => {
    expect(
      analyticsTotal({
        label: 'Followers',
        valueMode: 'latest',
        data: [
          { date: '2026-08-03', total: 99 },
          { date: '2026-08-01', total: 50 },
          { date: '2026-08-02', total: 75 },
        ],
      })
    ).toBe('99');
  });
});

describe('resolveDisplayUnit', () => {
  it('defaults average metrics to percentage without display metadata', () => {
    expect(
      resolveDisplayUnit({
        label: 'Engagement rate',
        data: [],
        valueMode: 'average',
      })
    ).toBe('percentage');
  });

  it('respects explicit duration display metadata', () => {
    expect(
      resolveDisplayUnit({
        label: 'Average View Duration',
        data: [],
        valueMode: 'average',
        displayUnit: 'duration',
      })
    ).toBe('duration');
  });
});

describe('AnalyticsCard', () => {
  it('hides the trend indicator when percentageChange is omitted', () => {
    render(
      <AnalyticsCard
        index={0}
        total="42"
        item={{
          label: 'Impressions',
          valueMode: 'sum',
          data: [{ date: '2026-08-01', total: 42 }],
        }}
      />
    );

    expect(screen.queryByText('%')).not.toBeInTheDocument();
    expect(screen.queryByText('pp')).not.toBeInTheDocument();
  });

  it('shows percentage-point trends for average percentage metrics', () => {
    render(
      <AnalyticsCard
        index={0}
        total="12.50%"
        item={{
          label: 'Engagement rate',
          valueMode: 'average',
          displayUnit: 'percentage',
          percentageChange: 2.5,
          data: [{ date: '2026-08-01', total: 12.5 }],
        }}
      />
    );

    expect(screen.getByText('2.5pp')).toBeInTheDocument();
  });

  it('shows plain trends for average duration metrics', () => {
    render(
      <AnalyticsCard
        index={0}
        total="1:05"
        item={{
          label: 'Average View Duration',
          valueMode: 'average',
          displayUnit: 'duration',
          percentageChange: 3.2,
          data: [{ date: '2026-08-01', total: 65 }],
        }}
      />
    );

    expect(screen.getByText('3.2')).toBeInTheDocument();
    expect(screen.queryByText('pp')).not.toBeInTheDocument();
    expect(screen.queryByText('%')).not.toBeInTheDocument();
  });
});

describe('RenderAnalytics collecting state', () => {
  it('shows a collecting message instead of a reconnect prompt', () => {
    usePlatformAnalytics.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(
      <RenderAnalytics
        integration={
          {
            id: 'integration-1',
          } as any
        }
        date={7}
      />
    );

    expect(
      screen.getByText(
        'Analytics history is still being collected. Metrics will appear after the first daily snapshots.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Refresh Channel')).not.toBeInTheDocument();
  });
});
