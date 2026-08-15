import { NotFoundException } from '@nestjs/common';
import { ChannelAnalyticsService } from './channel-analytics.service';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

jest.mock('@gitroom/nestjs-libraries/redis/redis.service', () => ({
  ioRedis: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

describe('ChannelAnalytics API shaping', () => {
  const createRepository = () => ({
    findOwnedIntegration: jest.fn(),
    getDailyPoints: jest.fn().mockResolvedValue([]),
    getSyncState: jest.fn(),
  });

  const createService = (repository = createRepository()) =>
    new ChannelAnalyticsService(repository as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (ioRedis.get as jest.Mock).mockResolvedValue(null);
    (ioRedis.set as jest.Mock).mockResolvedValue('OK');
  });

  it('scopes stored analytics to the requesting organization', async () => {
    const repository = createRepository();
    repository.findOwnedIntegration.mockResolvedValue(null);
    const service = createService(repository);

    await expect(
      service.getStoredAnalytics('org-a', 'integration-a', 7)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.getDailyPoints).not.toHaveBeenCalled();
  });

  it('returns an empty array before the first capture', async () => {
    const repository = createRepository();
    repository.findOwnedIntegration.mockResolvedValue({
      id: 'integration-a',
      type: 'social',
    });
    const service = createService(repository);

    await expect(
      service.getStoredAnalytics('org-a', 'integration-a', 7)
    ).resolves.toEqual([]);
    expect(ioRedis.get).not.toHaveBeenCalled();
    expect(ioRedis.set).not.toHaveBeenCalled();
  });

  it('returns stored values with valueMode and optional trend fields', async () => {
    const repository = createRepository();
    repository.findOwnedIntegration.mockResolvedValue({
      id: 'integration-a',
      type: 'social',
    });
    repository.getDailyPoints.mockResolvedValue([
      {
        metricKey: 'impressions',
        label: 'Impressions',
        valueMode: 'SUM',
        day: new Date('2026-08-01T00:00:00.000Z'),
        value: { toNumber: () => 2 },
      },
      {
        metricKey: 'impressions',
        label: 'Impressions',
        valueMode: 'SUM',
        day: new Date('2026-08-08T00:00:00.000Z'),
        value: { toNumber: () => 4 },
      },
      {
        metricKey: 'engagement_rate',
        label: 'Engagement rate',
        valueMode: 'AVERAGE',
        day: new Date('2026-08-01T00:00:00.000Z'),
        value: { toNumber: () => 2 },
      },
      {
        metricKey: 'engagement_rate',
        label: 'Engagement rate',
        valueMode: 'AVERAGE',
        day: new Date('2026-08-08T00:00:00.000Z'),
        value: { toNumber: () => 6 },
      },
    ]);
    const service = createService(repository);

    await expect(
      service.getStoredAnalytics(
        'org-a',
        'integration-a',
        7,
        new Date('2026-08-14T12:00:00.000Z')
      )
    ).resolves.toEqual([
      {
        label: 'Impressions',
        valueMode: 'sum',
        displayUnit: 'count',
        data: [{ date: '2026-08-08', total: 4 }],
      },
      {
        label: 'Engagement rate',
        valueMode: 'average',
        displayUnit: 'percentage',
        average: true,
        data: [{ date: '2026-08-08', total: 6 }],
      },
    ]);
    expect(ioRedis.get).not.toHaveBeenCalled();
  });

  it('returns resolved displayUnit for duration averages', async () => {
    const repository = createRepository();
    repository.findOwnedIntegration.mockResolvedValue({
      id: 'integration-a',
      type: 'social',
    });
    repository.getDailyPoints.mockResolvedValue([
      {
        metricKey: 'average_view_duration',
        label: 'Average View Duration',
        valueMode: 'AVERAGE',
        displayUnit: 'DURATION',
        day: new Date('2026-08-08T00:00:00.000Z'),
        value: { toNumber: () => 65 },
      },
    ]);
    const service = createService(repository);

    await expect(
      service.getStoredAnalytics(
        'org-a',
        'integration-a',
        7,
        new Date('2026-08-14T12:00:00.000Z')
      )
    ).resolves.toEqual([
      {
        label: 'Average View Duration',
        valueMode: 'average',
        displayUnit: 'duration',
        data: [{ date: '2026-08-08', total: 65 }],
      },
    ]);
  });

  it('rejects unsupported analytics windows', async () => {
    const service = createService();

    await expect(
      service.getStoredAnalytics('org-a', 'integration-a', 14 as 7)
    ).rejects.toThrow('Unsupported analytics window');
  });

  it('omits average metrics with no current-window observations from stored analytics', async () => {
    const repository = createRepository();
    repository.findOwnedIntegration.mockResolvedValue({
      id: 'integration-a',
      type: 'social',
    });
    repository.getDailyPoints.mockResolvedValue([
      {
        metricKey: 'engagement_rate',
        label: 'Engagement rate',
        valueMode: 'AVERAGE',
        day: new Date('2026-08-01T00:00:00.000Z'),
        value: { toNumber: () => 4 },
      },
      {
        metricKey: 'impressions',
        label: 'Impressions',
        valueMode: 'SUM',
        day: new Date('2026-08-08T00:00:00.000Z'),
        value: { toNumber: () => 3 },
      },
    ]);
    const service = createService(repository);

    await expect(
      service.getStoredAnalytics(
        'org-a',
        'integration-a',
        7,
        new Date('2026-08-14T12:00:00.000Z')
      )
    ).resolves.toEqual([
      {
        label: 'Impressions',
        valueMode: 'sum',
        displayUnit: 'count',
        data: [{ date: '2026-08-08', total: 3 }],
      },
    ]);
  });

  it('marks channels unavailable when capture never succeeded after failure', () => {
    const service = createService();
    expect(
      service.isChannelUnavailable({
        failureCount: 2,
        lastSuccessfulSnapshotAt: null,
      })
    ).toBe(true);
    expect(
      service.isChannelUnavailable({
        failureCount: 2,
        lastSuccessfulSnapshotAt: new Date(),
      })
    ).toBe(false);
  });
});
