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

const history: FollowerRelationshipSnapshot[] = [
  {
    snapshotAt: '2026-01-01T00:00:00.000Z',
    windowStartedAt: '2025-12-02T00:00:00.000Z',
    effortScore: 0,
    reciprocationScore: 0,
    reciprocity: null,
    grade: null,
    adjustedGrade: null,
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
    formulaVersion: 1,
  },
];

describe('FollowerRelationshipChart', () => {
  it('renders accessible grade history for every snapshot', () => {
    render(<FollowerRelationshipChart history={history} />);

    const table = screen.getByRole('table', { name: 'Grade history' });
    const rows = within(table).getAllByRole('row');

    expect(rows).toHaveLength(3);

    expect(
      screen.getByText('No grade (not enough tracked activity)')
    ).toBeTruthy();
    expect(screen.getByText('3.5')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders nothing when history is empty', () => {
    const { container } = render(<FollowerRelationshipChart history={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
