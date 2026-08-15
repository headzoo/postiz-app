/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import {
  downsampleAnalyticsPoints,
  sortAnalyticsPoints,
} from './chart-social';

describe('sortAnalyticsPoints', () => {
  it('sorts points by ISO date', () => {
    expect(
      sortAnalyticsPoints([
        { date: '2026-08-03', total: 3 },
        { date: '2026-08-01', total: 1 },
        { date: '2026-08-02', total: 2 },
      ])
    ).toEqual([
      { date: '2026-08-01', total: 1 },
      { date: '2026-08-02', total: 2 },
      { date: '2026-08-03', total: 3 },
    ]);
  });
});

describe('downsampleAnalyticsPoints', () => {
  const manyPoints = Array.from({ length: 14 }, (_, index) => ({
    date: `2026-08-${String(index + 1).padStart(2, '0')}`,
    total: index + 1,
  }));

  it('sums bucket totals for sum mode', () => {
    const buckets = downsampleAnalyticsPoints(manyPoints, 'sum');
    expect(buckets).toHaveLength(7);
    expect(buckets[0].total).toBe(1 + 2);
    expect(buckets[6].total).toBe(13 + 14);
  });

  it('averages bucket totals for average mode', () => {
    const buckets = downsampleAnalyticsPoints(manyPoints, 'average');
    expect(buckets[0].total).toBe((1 + 2) / 2);
    expect(buckets[6].total).toBe((13 + 14) / 2);
  });

  it('uses the latest bucket point for latest mode', () => {
    const buckets = downsampleAnalyticsPoints(manyPoints, 'latest');
    expect(buckets[0].total).toBe(2);
    expect(buckets[6].total).toBe(14);
  });

  it('keeps a single stored point without duplication', () => {
    const single = [{ date: '2026-08-01', total: 42 }];
    expect(downsampleAnalyticsPoints(single, 'sum')).toEqual(single);
    expect(downsampleAnalyticsPoints(single, 'average')).toEqual(single);
    expect(downsampleAnalyticsPoints(single, 'latest')).toEqual(single);
  });

  it('does not inject a synthetic zero start', () => {
    const points = [
      { date: '2026-08-05', total: 10 },
      { date: '2026-08-06', total: 20 },
    ];
    const buckets = downsampleAnalyticsPoints(points, 'sum');
    expect(buckets).toHaveLength(2);
    expect(buckets[0].date).toBe('2026-08-05');
    expect(buckets[0].total).toBe(10);
  });

  it('preserves negative totals in downsampled buckets', () => {
    const points = [
      { date: '2026-08-01', total: -5 },
      { date: '2026-08-02', total: 3 },
      { date: '2026-08-03', total: -2 },
    ];
    const buckets = downsampleAnalyticsPoints(points, 'sum');
    expect(buckets.some((bucket) => bucket.total < 0)).toBe(true);
  });

  it('labels multi-day buckets with a truthful date range', () => {
    const buckets = downsampleAnalyticsPoints(manyPoints, 'sum');
    expect(buckets[0].date).toBe('2026-08-01 - 2026-08-02');
    expect(buckets[6].date).toBe('2026-08-13 - 2026-08-14');
  });
});
