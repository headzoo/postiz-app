import { ChannelAnalyticsRepository } from './channel-analytics.repository';
import { Prisma } from '@prisma/client';

const createHarness = () => {
  const tx = {
    integration: {
      findFirst: jest.fn().mockResolvedValue({ id: 'integration' }),
    },
    channelAnalyticsDailyPoint: { upsert: jest.fn().mockResolvedValue({}) },
    channelAnalyticsPostMetricSnapshot: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    channelAnalyticsSyncState: {
      findUnique: jest.fn(),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const integration = { findMany: jest.fn() };
  const repository = new ChannelAnalyticsRepository(
    { model: { channelAnalyticsDailyPoint: { findMany: jest.fn() } } } as any,
    { model: { integration } } as any,
    { model: { $transaction: jest.fn((callback) => callback(tx)) } } as any
  );
  return { repository, tx, integration };
};

describe('ChannelAnalyticsRepository', () => {
  it('limits due candidates to caller-approved provider identifiers', async () => {
    const { repository, integration } = createHarness();
    integration.findMany.mockResolvedValue([]);
    await repository.listDueCandidates(
      ['provider-a'],
      new Date('2026-08-15T00:00:00Z')
    );
    expect(integration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerIdentifier: { in: ['provider-a'] },
          disabled: false,
          deletedAt: null,
        }),
        orderBy: [
          { channelAnalyticsSyncState: { nextAttemptAt: 'asc' } },
          { id: 'asc' },
        ],
        take: 51,
      })
    );
  });

  it('writes retry-safe daily points under the tenant-owned integration', async () => {
    const { repository, tx } = createHarness();
    await repository.persistDailyPage(
      'org',
      'integration',
      new Date('2026-08-15T12:00:00Z'),
      [
        {
          metricKey: 'views',
          label: 'Views',
          valueMode: 'SUM' as any,
          value: 1,
          day: new Date('2026-08-15T00:00:00Z'),
        },
      ],
      {
        fromDay: new Date('2026-08-01T00:00:00Z'),
        toDay: new Date('2026-08-15T00:00:00Z'),
      }
    );
    expect(tx.channelAnalyticsDailyPoint.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          integrationId_day_metricKey: {
            integrationId: 'integration',
            day: new Date('2026-08-15T00:00:00Z'),
            metricKey: 'views',
          },
        },
      })
    );
  });

  it('uses the first post-lifetime snapshot only as a baseline', async () => {
    const { repository, tx } = createHarness();
    tx.channelAnalyticsSyncState.findUnique.mockResolvedValue(null);
    const result = await repository.finalizePostLifetimeCapture(
      'org',
      'integration',
      new Date('2026-08-15T12:00:00Z')
    );
    expect(result).toEqual({ finalized: true, derived: 0 });
    expect(tx.channelAnalyticsDailyPoint.upsert).not.toHaveBeenCalled();
  });

  it('extends X coverage for consecutive successful empty snapshots', async () => {
    const { repository, tx } = createHarness();
    const snapshotAt = new Date('2026-08-15T12:00:00Z');
    tx.channelAnalyticsSyncState.findUnique.mockResolvedValue({
      lastSuccessfulSnapshotAt: new Date('2026-08-14T12:00:00Z'),
      coverageStartDay: null,
      coverageEndDay: null,
      pendingCoverageSnapshotAt: null,
      pendingCoverageStartDay: null,
      pendingCoverageEndDay: null,
    });
    tx.channelAnalyticsPostMetricSnapshot.findMany.mockResolvedValue([]);

    await expect(
      repository.finalizePostLifetimeCapture('org', 'integration', snapshotAt)
    ).resolves.toEqual({ finalized: true, derived: 0 });

    expect(tx.channelAnalyticsDailyPoint.upsert).not.toHaveBeenCalled();
    expect(tx.channelAnalyticsSyncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          coverageStartDay: new Date('2026-08-15T00:00:00Z'),
          coverageEndDay: new Date('2026-08-15T00:00:00Z'),
        }),
      })
    );
  });

  it('extends X coverage when consecutive snapshots have non-overlapping posts', async () => {
    const { repository, tx } = createHarness();
    const snapshotAt = new Date('2026-08-15T12:00:00Z');
    tx.channelAnalyticsSyncState.findUnique.mockResolvedValue({
      lastSuccessfulSnapshotAt: new Date('2026-08-14T12:00:00Z'),
      coverageStartDay: new Date('2026-08-14T00:00:00Z'),
      coverageEndDay: new Date('2026-08-14T00:00:00Z'),
      pendingCoverageSnapshotAt: null,
      pendingCoverageStartDay: null,
      pendingCoverageEndDay: null,
    });
    tx.channelAnalyticsPostMetricSnapshot.findMany
      .mockResolvedValueOnce([
        {
          externalPostId: 'current-post',
          metricKey: 'impressions',
          label: 'Impressions',
          valueMode: 'SUM',
          displayUnit: 'COUNT',
          value: new Prisma.Decimal(2),
        },
      ])
      .mockResolvedValueOnce([
        {
          externalPostId: 'previous-post',
          metricKey: 'impressions',
          label: 'Impressions',
          valueMode: 'SUM',
          displayUnit: 'COUNT',
          value: new Prisma.Decimal(1),
        },
      ]);

    await repository.finalizePostLifetimeCapture(
      'org',
      'integration',
      snapshotAt
    );

    expect(tx.channelAnalyticsDailyPoint.upsert).not.toHaveBeenCalled();
    expect(tx.channelAnalyticsSyncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          coverageStartDay: new Date('2026-08-14T00:00:00Z'),
          coverageEndDay: new Date('2026-08-15T00:00:00Z'),
        }),
      })
    );
  });

  it('does not extend X coverage across snapshot-day gaps', async () => {
    const { repository, tx } = createHarness();
    tx.channelAnalyticsSyncState.findUnique.mockResolvedValue({
      lastSuccessfulSnapshotAt: new Date('2026-08-13T12:00:00Z'),
      coverageStartDay: new Date('2026-08-13T00:00:00Z'),
      coverageEndDay: new Date('2026-08-13T00:00:00Z'),
      pendingCoverageSnapshotAt: null,
      pendingCoverageStartDay: null,
      pendingCoverageEndDay: null,
    });
    tx.channelAnalyticsPostMetricSnapshot.findMany.mockResolvedValue([]);

    await repository.finalizePostLifetimeCapture(
      'org',
      'integration',
      new Date('2026-08-15T12:00:00Z')
    );

    expect(tx.channelAnalyticsDailyPoint.upsert).not.toHaveBeenCalled();
    expect(tx.channelAnalyticsSyncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({
          coverageStartDay: expect.anything(),
          coverageEndDay: expect.anything(),
        }),
      })
    );
  });

  it('is idempotent when retrying the same post-lifetime snapshot', async () => {
    const { repository, tx } = createHarness();
    const snapshotAt = new Date('2026-08-15T12:00:00Z');
    tx.channelAnalyticsSyncState.findUnique.mockResolvedValue({
      lastSuccessfulSnapshotAt: snapshotAt,
    });
    await expect(
      repository.finalizePostLifetimeCapture('org', 'integration', snapshotAt)
    ).resolves.toEqual({ finalized: false, derived: 0 });
    expect(
      tx.channelAnalyticsPostMetricSnapshot.findMany
    ).not.toHaveBeenCalled();
    expect(tx.channelAnalyticsDailyPoint.upsert).not.toHaveBeenCalled();
    expect(tx.channelAnalyticsSyncState.upsert).not.toHaveBeenCalled();
  });

  it('schedules successful daily captures for the next UTC day', async () => {
    const { repository, tx } = createHarness();
    tx.channelAnalyticsSyncState.findUnique.mockResolvedValue({
      pendingCoverageSnapshotAt: new Date('2026-08-15T12:00:00Z'),
      pendingCoverageStartDay: new Date('2026-02-16T00:00:00Z'),
      pendingCoverageEndDay: new Date('2026-08-15T00:00:00Z'),
    });

    await repository.finalizeDailyCapture(
      'org',
      'integration',
      new Date('2026-08-15T12:00:00Z'),
      new Date('2026-08-15T00:00:00Z')
    );

    expect(tx.channelAnalyticsSyncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          nextAttemptAt: new Date('2026-08-16T00:00:00Z'),
          coverageStartDay: new Date('2026-02-16T00:00:00Z'),
          coverageEndDay: new Date('2026-08-15T00:00:00Z'),
        }),
      })
    );
  });

  it('accumulates adjacent one-day gauge coverage', async () => {
    const { repository, tx } = createHarness();
    tx.channelAnalyticsSyncState.findUnique.mockResolvedValue({
      coverageStartDay: new Date('2026-08-01T00:00:00Z'),
      coverageEndDay: new Date('2026-08-15T00:00:00Z'),
      pendingCoverageSnapshotAt: new Date('2026-08-16T12:00:00Z'),
      pendingCoverageStartDay: new Date('2026-08-16T00:00:00Z'),
      pendingCoverageEndDay: new Date('2026-08-16T00:00:00Z'),
    });

    await repository.finalizeDailyCapture(
      'org',
      'integration',
      new Date('2026-08-16T12:00:00Z'),
      new Date('2026-08-16T00:00:00Z')
    );

    expect(tx.channelAnalyticsSyncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          coverageStartDay: new Date('2026-08-01T00:00:00Z'),
          coverageEndDay: new Date('2026-08-16T00:00:00Z'),
        }),
      })
    );
  });

  it('retains earlier rolling historical coverage when intervals overlap', async () => {
    const { repository, tx } = createHarness();
    tx.channelAnalyticsSyncState.findUnique.mockResolvedValue({
      coverageStartDay: new Date('2026-02-16T00:00:00Z'),
      coverageEndDay: new Date('2026-08-15T00:00:00Z'),
      pendingCoverageSnapshotAt: new Date('2026-08-16T12:00:00Z'),
      pendingCoverageStartDay: new Date('2026-05-19T00:00:00Z'),
      pendingCoverageEndDay: new Date('2026-08-16T00:00:00Z'),
    });

    await repository.finalizeDailyCapture(
      'org',
      'integration',
      new Date('2026-08-16T12:00:00Z'),
      new Date('2026-08-16T00:00:00Z')
    );

    expect(tx.channelAnalyticsSyncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          coverageStartDay: new Date('2026-02-16T00:00:00Z'),
          coverageEndDay: new Date('2026-08-16T00:00:00Z'),
        }),
      })
    );
  });

  it('does not bridge a gap in committed coverage', async () => {
    const { repository, tx } = createHarness();
    tx.channelAnalyticsSyncState.findUnique.mockResolvedValue({
      coverageStartDay: new Date('2026-08-01T00:00:00Z'),
      coverageEndDay: new Date('2026-08-10T00:00:00Z'),
      pendingCoverageSnapshotAt: new Date('2026-08-16T12:00:00Z'),
      pendingCoverageStartDay: new Date('2026-08-15T00:00:00Z'),
      pendingCoverageEndDay: new Date('2026-08-16T00:00:00Z'),
    });

    await repository.finalizeDailyCapture(
      'org',
      'integration',
      new Date('2026-08-16T12:00:00Z'),
      new Date('2026-08-16T00:00:00Z')
    );

    expect(tx.channelAnalyticsSyncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({
          coverageStartDay: expect.anything(),
          coverageEndDay: expect.anything(),
        }),
      })
    );
  });

  it('establishes X delta coverage after seven consecutive derived days', async () => {
    const { repository, tx } = createHarness();
    const firstSnapshot = new Date('2026-08-01T12:00:00Z');
    let coverageStartDay: Date | null = null;
    let coverageEndDay: Date | null = null;

    for (let offset = 1; offset <= 7; offset++) {
      const snapshotAt = new Date(firstSnapshot);
      snapshotAt.setUTCDate(snapshotAt.getUTCDate() + offset);
      const previousSnapshotAt = new Date(snapshotAt);
      previousSnapshotAt.setUTCDate(previousSnapshotAt.getUTCDate() - 1);
      const state = {
        lastSuccessfulSnapshotAt: previousSnapshotAt,
        coverageStartDay,
        coverageEndDay,
        pendingCoverageSnapshotAt: null,
        pendingCoverageStartDay: null,
        pendingCoverageEndDay: null,
      };
      tx.channelAnalyticsSyncState.findUnique
        .mockResolvedValueOnce(state)
        .mockResolvedValueOnce(state);
      tx.channelAnalyticsPostMetricSnapshot.findMany
        .mockResolvedValueOnce([
          {
            externalPostId: 'post',
            metricKey: 'impressions',
            label: 'Impressions',
            valueMode: 'SUM',
            displayUnit: 'COUNT',
            value: new Prisma.Decimal(2),
          },
        ])
        .mockResolvedValueOnce([
          {
            externalPostId: 'post',
            metricKey: 'impressions',
            label: 'Impressions',
            valueMode: 'SUM',
            displayUnit: 'COUNT',
            value: new Prisma.Decimal(1),
          },
        ]);

      await repository.finalizePostLifetimeCapture(
        'org',
        'integration',
        snapshotAt
      );
      coverageStartDay ||= new Date(snapshotAt);
      coverageStartDay.setUTCHours(0, 0, 0, 0);
      coverageEndDay = new Date(coverageStartDay);
      coverageEndDay.setUTCDate(coverageStartDay.getUTCDate() + offset - 1);
    }

    expect(tx.channelAnalyticsSyncState.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          coverageStartDay: new Date('2026-08-02T00:00:00Z'),
          coverageEndDay: new Date('2026-08-08T00:00:00Z'),
        }),
      })
    );
  });

  it('schedules an immediate capture without clearing failure state', async () => {
    const { repository, tx } = createHarness();
    tx.channelAnalyticsSyncState.findUnique.mockResolvedValue({
      failureCount: 2,
    });
    await repository.scheduleImmediateCapture(
      'org',
      'integration',
      new Date(0)
    );
    expect(tx.channelAnalyticsSyncState.upsert).toHaveBeenCalledWith({
      where: { integrationId: 'integration' },
      create: {
        organizationId: 'org',
        integrationId: 'integration',
        nextAttemptAt: new Date(0),
      },
      update: { nextAttemptAt: new Date(0) },
    });
  });
});
