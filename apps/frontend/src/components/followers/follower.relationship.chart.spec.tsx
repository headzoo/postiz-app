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
import { render, screen, within } from '@testing-library/react';
import { FollowerRelationshipChart } from './follower.relationship.chart';
import { FollowerRelationshipSnapshot } from './use.followers';

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

const history: FollowerRelationshipSnapshot[] = [
  {
    snapshotAt: '2026-01-01T00:00:00.000Z',
    windowStartedAt: '2025-12-02T00:00:00.000Z',
    effortScore: 0,
    reciprocationScore: 0,
    reciprocity: null,
    grade: null,
    adjustedGrade: null,
    effortStars: 1,
    reciprocationStars: 1,
    triage: 'quiet',
    formulaVersion: 1,
  },
  {
    snapshotAt: '2026-02-01T00:00:00.000Z',
    windowStartedAt: '2026-01-02T00:00:00.000Z',
    effortScore: 10,
    reciprocationScore: 5,
    reciprocity: 0.5,
    grade: 3.5,
    adjustedGrade: 3.5,
    effortStars: 2,
    reciprocationStars: 1.5,
    triage: 'over_invested',
    formulaVersion: 1,
  },
];

const mixedHistory: FollowerRelationshipSnapshot[] = [
  ...history,
  {
    snapshotAt: '2026-03-01T00:00:00.000Z',
    windowStartedAt: '2026-01-30T00:00:00.000Z',
    effortScore: 8,
    reciprocationScore: 12,
    reciprocity: 0.67,
    grade: 4,
    adjustedGrade: 4,
    effortStars: 1.5,
    reciprocationStars: 2,
    triage: 'hot_lead',
    formulaVersion: 2,
  },
];

describe('FollowerRelationshipChart', () => {
  it('renders accessible grade history for every snapshot', () => {
    render(<FollowerRelationshipChart history={history} />);

    const table = screen.getByRole('table', { name: 'Relationship history' });
    const rows = within(table).getAllByRole('row');

    expect(rows).toHaveLength(3);

    expect(
      screen.getByText('No grade (not enough tracked activity)')
    ).toBeTruthy();
    expect(screen.getByText('3.5')).toBeTruthy();
    expect(screen.getAllByText('Reciprocity (v1)')).toHaveLength(2);
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText(/out of 5/i)).toBeNull();
  });

  it('labels mixed formula versions separately in the history table', () => {
    render(<FollowerRelationshipChart history={mixedHistory} />);

    expect(screen.getAllByText('Reciprocity (v1)')).toHaveLength(2);
    expect(screen.getByText('Priority (v2)')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('renders nothing when history is empty', () => {
    const { container } = render(<FollowerRelationshipChart history={[]} />);

    expect(container.firstChild).toBeNull();
  });
});
