import {
  ChannelAudienceMembership,
  ChannelFollowerSyncStatus,
  ChannelInteractionDirection,
  ChannelInteractionKind,
  ChannelInteractionWindow,
} from '@prisma/client';
import { ChannelInteractionRepository } from './channel-interaction.repository';

const event = (overrides: Record<string, any> = {}) => ({
  providerEventKey: 'event-1',
  kind: ChannelInteractionKind.LIKE,
  direction: ChannelInteractionDirection.INBOUND,
  eventAt: new Date('2026-08-12T23:30:00.000Z'),
  counterparty: { externalId: 'person-1', name: 'Person' },
  normalizationVersion: 1,
  score: 2,
  ...overrides,
});

const createHarness = () => {
  const tx = {
    integration: { findFirst: jest.fn().mockResolvedValue({ id: 'integration' }) },
    channelAudienceMember: {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    channelInteractionEvent: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    channelInteractionDailyAggregate: {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    channelFollowerSyncState: {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    channelInteractionWindowSummary: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn(),
    },
    channelInteractionRollupState: {
      upsert: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn(),
    },
    channelInteractionSubscription: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    channelRelationshipGradeSnapshot: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    channelAudienceNote: {
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    userOrganization: { findFirst: jest.fn().mockResolvedValue({ id: 'member' }) },
  };
  const transaction = jest.fn((callback: (client: any) => unknown) => callback(tx));
  const integrationFindMany = jest.fn();
  const repository = new ChannelInteractionRepository(
    {
      model: {
        channelInteractionDailyAggregate: {},
        channelInteractionEvent: {},
        channelInteractionRollupState: {},
        channelFollowerSyncState: {},
        channelInteractionWindowSummary: {},
        channelAudienceMember: {
          findFirst: tx.channelAudienceMember.findFirst,
        },
        channelAudienceNote: tx.channelAudienceNote,
        channelRelationshipGradeSnapshot: tx.channelRelationshipGradeSnapshot,
      },
    } as any,
    { model: { integration: { findMany: integrationFindMany } } } as any,
    { model: { channelInteractionSubscription: { updateMany: jest.fn() } } } as any,
    { model: { $transaction: transaction } } as any
  );
  return {
    repository,
    tx,
    groupBy: tx.channelInteractionEvent.groupBy,
    transaction,
    findFirst: tx.channelInteractionRollupState.findFirst,
    followerSyncFindFirst: tx.channelFollowerSyncState.findFirst,
    findMany: tx.channelInteractionWindowSummary.findMany,
    integrationFindMany,
    audienceMemberFindMany: tx.channelAudienceMember.findMany,
  };
};

describe('ChannelInteractionRepository', () => {
  it('increments the UTC daily aggregate once under concurrent duplicate delivery', async () => {
    const { repository, tx } = createHarness();
    tx.channelInteractionEvent.createMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.all([
      repository.recordNormalizedEvent('org', 'integration', event()),
      repository.recordNormalizedEvent('org', 'integration', event()),
    ]);

    expect(results).toEqual(
      expect.arrayContaining([{ created: true }, { created: false }])
    );
    expect(tx.channelInteractionDailyAggregate.upsert).toHaveBeenCalledTimes(1);
    expect(tx.channelInteractionDailyAggregate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          integrationId_counterpartyExternalId_day: {
            integrationId: 'integration',
            counterpartyExternalId: 'person-1',
            day: new Date('2026-08-12T00:00:00.000Z'),
          },
        },
        update: {
          interactionCount: { increment: 1 },
          interactionScore: { increment: 2 },
        },
      })
    );
  });

  it('refreshes profiles without promoting unknown membership', async () => {
    const { repository, tx } = createHarness();
    await repository.recordNormalizedEvent('org', 'integration', event());

    expect(tx.channelAudienceMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ name: 'Person' }),
      })
    );
    expect(tx.channelAudienceMember.upsert.mock.calls[0][0].update)
      .not.toHaveProperty('membershipState');
  });

  it('rejects a cross-organization integration before any interaction write', async () => {
    const { repository, tx } = createHarness();
    tx.integration.findFirst.mockResolvedValue(null);

    await expect(
      repository.recordNormalizedEvent('wrong-org', 'integration', event())
    ).rejects.toThrow('does not belong');
    expect(tx.channelInteractionEvent.createMany).not.toHaveBeenCalled();
  });

  it('prevents stale follower pages from stamping a newer snapshot', async () => {
    const { repository, tx } = createHarness();
    tx.channelFollowerSyncState.updateMany.mockResolvedValue({ count: 0 });

    const applied = await repository.applyFollowerSyncPage(
      'org',
      'integration',
      'stale-generation',
      [{ externalId: 'person-1' }]
    );

    expect(applied).toBe(false);
    expect(tx.channelAudienceMember.upsert).not.toHaveBeenCalled();
  });

  it('stages follower membership without exposing partial additions', async () => {
    const { repository, tx } = createHarness();

    await repository.applyFollowerSyncPage(
      'org',
      'integration',
      'generation-2',
      [{ externalId: 'person-1' }]
    );

    expect(tx.channelAudienceMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          followerSyncGeneration: 'generation-2',
        }),
        update: expect.objectContaining({
          followerSyncGeneration: 'generation-2',
        }),
      })
    );
    expect(tx.channelAudienceMember.upsert.mock.calls[0][0].create)
      .not.toHaveProperty('membershipState');
    expect(tx.channelAudienceMember.upsert.mock.calls[0][0].update)
      .not.toHaveProperty('membershipState');
  });

  it('prevents stale completion from demoting the active generation', async () => {
    const { repository, tx } = createHarness();
    tx.channelFollowerSyncState.updateMany.mockResolvedValue({ count: 0 });

    const completed = await repository.completeFollowerSync(
      'org',
      'integration',
      'stale-generation',
      new Date()
    );

    expect(completed).toBe(false);
    expect(tx.channelAudienceMember.updateMany).not.toHaveBeenCalled();
  });

  it('demotes only followers absent from the successfully completed generation', async () => {
    const { repository, tx } = createHarness();
    const completed = await repository.completeFollowerSync(
      'org',
      'integration',
      'generation-2',
      new Date('2026-08-12T12:00:00.000Z')
    );

    expect(completed).toBe(true);
    expect(tx.channelAudienceMember.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        organizationId: 'org',
        integrationId: 'integration',
        followerSyncGeneration: 'generation-2',
        OR: [
          { membershipEvidenceGeneration: null },
          { membershipEvidenceGeneration: { not: 'generation-2' } },
        ],
      },
      data: { membershipState: ChannelAudienceMembership.FOLLOWER },
    });
    expect(tx.channelAudienceMember.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org',
        integrationId: 'integration',
        membershipState: ChannelAudienceMembership.FOLLOWER,
        AND: [
          {
            OR: [
              { followerSyncGeneration: null },
              { followerSyncGeneration: { not: 'generation-2' } },
            ],
          },
          {
            OR: [
              { membershipEvidenceGeneration: null },
              { membershipEvidenceGeneration: { not: 'generation-2' } },
            ],
          },
        ],
      },
      data: { membershipState: ChannelAudienceMembership.NOT_FOLLOWER },
    });
    expect(tx.channelFollowerSyncState.update).toHaveBeenCalledWith({
      where: { integrationId: 'integration' },
      data: {
        activeGeneration: 'generation-2',
        pendingGeneration: null,
        status: ChannelFollowerSyncStatus.COMPLETE,
        completedAt: new Date('2026-08-12T12:00:00.000Z'),
      },
    });
  });

  it('preserves a follow received during the active follower sync', async () => {
    const { repository, tx } = createHarness();
    tx.channelFollowerSyncState.findFirst.mockResolvedValue({
      pendingGeneration: 'generation-2',
    });

    await repository.recordNormalizedEvent(
      'org',
      'integration',
      event({
        kind: ChannelInteractionKind.FOLLOW,
        membershipUpdate: ChannelAudienceMembership.FOLLOWER,
      })
    );
    await repository.completeFollowerSync(
      'org',
      'integration',
      'generation-2',
      new Date()
    );

    expect(tx.channelAudienceMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          membershipState: ChannelAudienceMembership.FOLLOWER,
          membershipEvidenceGeneration: 'generation-2',
        }),
      })
    );
    expect(tx.channelAudienceMember.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              OR: [
                { membershipEvidenceGeneration: null },
                { membershipEvidenceGeneration: { not: 'generation-2' } },
              ],
            },
          ]),
        }),
      })
    );
  });

  it('preserves an unfollow received after its profile was staged', async () => {
    const { repository, tx } = createHarness();
    tx.channelFollowerSyncState.findFirst.mockResolvedValue({
      pendingGeneration: 'generation-2',
    });

    await repository.applyFollowerSyncPage(
      'org',
      'integration',
      'generation-2',
      [{ externalId: 'person-1' }]
    );
    await repository.applyMembershipUpdate(
      'org',
      'integration',
      { externalId: 'person-1' },
      ChannelAudienceMembership.NOT_FOLLOWER
    );
    await repository.completeFollowerSync(
      'org',
      'integration',
      'generation-2',
      new Date()
    );

    expect(tx.channelAudienceMember.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          membershipState: ChannelAudienceMembership.NOT_FOLLOWER,
          membershipEvidenceGeneration: 'generation-2',
        }),
      })
    );
    expect(tx.channelAudienceMember.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          followerSyncGeneration: 'generation-2',
          OR: [
            { membershipEvidenceGeneration: null },
            { membershipEvidenceGeneration: { not: 'generation-2' } },
          ],
        }),
      })
    );
  });

  it('retains the last complete snapshot while a new sync begins and fails', async () => {
    const { repository, tx } = createHarness();

    await repository.beginFollowerSync('org', 'integration', 'generation-2');
    expect(tx.channelFollowerSyncState.upsert.mock.calls[0][0].update)
      .not.toHaveProperty('activeGeneration');
    expect(tx.channelFollowerSyncState.upsert.mock.calls[0][0].update)
      .not.toHaveProperty('completedAt');

    await repository.failFollowerSync('org', 'integration', 'generation-2');
    expect(tx.channelFollowerSyncState.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          pendingGeneration: null,
          status: ChannelFollowerSyncStatus.FAILED,
        },
      })
    );
  });

  it('keeps failed cleanup pending and completes it only after remote removal succeeds', async () => {
    const { repository, tx } = createHarness();
    const failedCleanup = {
      state: 'error',
      subscriptions: [{
        eventKey: 'like',
        direction: 'inbound',
        state: 'error',
        failureCategory: 'transient',
      }],
      coverage: [],
    } as any;
    const completeCleanup = {
      state: 'unconfigured',
      subscriptions: [{
        eventKey: 'like',
        direction: 'inbound',
        state: 'unconfigured',
      }],
      coverage: [],
    } as any;

    await repository.applySubscriptionReconciliation(
      'org',
      'integration',
      failedCleanup,
      true
    );
    expect(tx.channelInteractionSubscription.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: 'REMOVING',
          failureCategory: 'transient',
        }),
      })
    );

    await repository.applySubscriptionReconciliation(
      'org',
      'integration',
      completeCleanup,
      true
    );
    expect(tx.channelInteractionSubscription.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: 'UNCONFIGURED',
          failureCategory: null,
        }),
      })
    );
  });

  it('selects disabled integrations only while subscription cleanup is pending', async () => {
    const { repository, integrationFindMany } = createHarness();
    integrationFindMany.mockResolvedValue([{
      id: 'disabled-integration',
      organizationId: 'org',
      disabled: true,
      deletedAt: null,
    }]);

    await expect(repository.listMaintenanceCandidates()).resolves.toEqual({
      candidates: [{
        id: 'disabled-integration',
        organizationId: 'org',
        maintenance: 'cleanup',
      }],
      next: undefined,
    });
    expect(integrationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({
            channelInteractionSubscriptions: {
              some: { state: 'REMOVING' },
            },
          }),
        ]),
      }),
    }));
  });

  it('switches even an empty rollup generation before deleting stale rows', async () => {
    const { repository, tx, groupBy, audienceMemberFindMany } = createHarness();
    const computedAt = new Date('2026-08-12T12:00:00.000Z');
    const cutoffAt = new Date('2026-08-05T12:00:00.000Z');

    const result = await repository.rebuildWindowSummary(
      'org',
      'integration',
      ChannelInteractionWindow.WEEK,
      'new-generation',
      cutoffAt,
      computedAt
    );

    expect(result.itemCount).toBe(0);
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        organizationId: 'org',
        integrationId: 'integration',
        eventAt: { gte: cutoffAt, lte: computedAt },
      },
    }));
    expect(audienceMemberFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org',
        integrationId: 'integration',
        membershipState: ChannelAudienceMembership.FOLLOWER,
      },
      select: { externalId: true },
    });
    expect(tx.channelInteractionWindowSummary.createMany).not.toHaveBeenCalled();
    expect(tx.channelInteractionRollupState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ activeGeneration: 'new-generation' }),
      })
    );
    expect(
      tx.channelInteractionRollupState.upsert.mock.invocationCallOrder[0]
    ).toBeLessThan(
      tx.channelInteractionWindowSummary.deleteMany.mock.invocationCallOrder[0]
    );
  });

  it('preserves the previous active rollup if writing the new generation fails', async () => {
    const { repository, tx, groupBy } = createHarness();
    groupBy.mockResolvedValue([{
      counterpartyExternalId: 'person-1',
      kind: ChannelInteractionKind.LIKE,
      direction: ChannelInteractionDirection.INBOUND,
      _count: { _all: 2 },
      _max: { eventAt: new Date('2026-08-12T12:00:00.000Z') },
    }]);
    tx.channelInteractionWindowSummary.createMany.mockRejectedValue(
      new Error('write failed')
    );

    await expect(
      repository.rebuildWindowSummary(
        'org',
        'integration',
        ChannelInteractionWindow.WEEK,
        'new-generation',
        new Date('2026-08-06T00:00:00.000Z'),
        new Date()
      )
    ).rejects.toThrow('write failed');
    expect(tx.channelInteractionRollupState.upsert).not.toHaveBeenCalled();
    expect(tx.channelInteractionWindowSummary.deleteMany).not.toHaveBeenCalled();
  });

  it('materializes zero-valued summaries for followers only', async () => {
    const { repository, tx, groupBy, audienceMemberFindMany } = createHarness();
    const computedAt = new Date('2026-08-12T12:00:00.000Z');
    groupBy.mockResolvedValue([{
      counterpartyExternalId: 'active-follower',
      kind: ChannelInteractionKind.LIKE,
      direction: ChannelInteractionDirection.INBOUND,
      _count: { _all: 2 },
      _max: { eventAt: computedAt },
    }]);
    audienceMemberFindMany.mockResolvedValue([
      { externalId: 'active-follower' },
      { externalId: 'zero-follower' },
    ]);

    await expect(
      repository.rebuildWindowSummary(
        'org',
        'integration',
        ChannelInteractionWindow.MONTH,
        'generation-a',
        new Date('2026-07-12T12:00:00.000Z'),
        computedAt
      )
    ).resolves.toMatchObject({ itemCount: 2 });

    expect(tx.channelInteractionWindowSummary.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            counterpartyExternalId: 'active-follower',
            interactionCount: 2,
            interactionScore: 4,
            lastInteractionAt: computedAt,
          }),
          expect.objectContaining({
            counterpartyExternalId: 'zero-follower',
            interactionCount: 0,
            interactionScore: 0,
            lastInteractionAt: null,
          }),
        ]),
      })
    );
  });

  it('queries only current followers in the active summary generation', async () => {
    const {
      repository,
      transaction,
      findFirst,
      followerSyncFindFirst,
      findMany,
    } = createHarness();
    findFirst.mockResolvedValue({
      activeGeneration: 'generation-a',
      computedAt: new Date('2026-08-12T12:00:00.000Z'),
    });
    followerSyncFindFirst.mockResolvedValue({
      activeGeneration: 'followers-a',
      status: ChannelFollowerSyncStatus.IN_PROGRESS,
      completedAt: new Date('2026-08-11T12:00:00.000Z'),
    });
    findMany.mockResolvedValue([]);
    (repository as any)._transaction.model.$transaction = transaction;

    await repository.getRankedFollowers({
      organizationId: 'org',
      integrationId: 'integration',
      window: ChannelInteractionWindow.MONTH,
      direction: 'desc',
      limit: 24,
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org',
        integrationId: 'integration',
        generation: 'generation-a',
        audienceMember: {
          is: {
            organizationId: 'org',
            integrationId: 'integration',
            membershipState: ChannelAudienceMembership.FOLLOWER,
          },
        },
      }),
      take: 25,
      orderBy: [
        { interactionCount: 'desc' },
        { interactionScore: 'desc' },
        { lastInteractionAt: 'desc' },
        { counterpartyExternalId: 'desc' },
      ],
    }));
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('uses null-aware keysets so zero-ranked followers remain pageable', () => {
    const { repository } = createHarness();

    expect(
      (repository as any).rankedFollowerKeyset(
        {
          interactionCount: 0,
          interactionScore: 0,
          lastInteractionAt: null,
          externalId: 'follower-a',
        },
        'desc'
      )
    ).toEqual(expect.objectContaining({
      OR: expect.arrayContaining([
        expect.objectContaining({
          interactionCount: 0,
          interactionScore: 0,
          lastInteractionAt: { not: null },
        }),
        expect.objectContaining({
          interactionCount: 0,
          interactionScore: 0,
          lastInteractionAt: null,
          counterpartyExternalId: { lt: 'follower-a' },
        }),
      ]),
    }));

    expect(
      (repository as any).rankedFollowerKeyset(
        {
          interactionCount: 0,
          interactionScore: 0,
          lastInteractionAt: '2026-08-12T12:00:00.000Z',
          externalId: 'follower-a',
        },
        'asc'
      )
    ).toEqual(expect.objectContaining({
      OR: expect.arrayContaining([
        expect.objectContaining({
          interactionCount: 0,
          interactionScore: 0,
          OR: [
            { lastInteractionAt: { gt: new Date('2026-08-12T12:00:00.000Z') } },
            { lastInteractionAt: null },
          ],
        }),
      ]),
    }));
  });

  it('builds a bounded due batch from events with directional E/R scores', async () => {
    const { repository, tx, groupBy } = createHarness();
    tx.channelAudienceMember.findMany.mockResolvedValue([
      { externalId: 'outbound-only' },
      { externalId: 'zero-activity' },
    ]);
    groupBy.mockResolvedValue([{
      counterpartyExternalId: 'outbound-only',
      kind: ChannelInteractionKind.REPLY,
      direction: ChannelInteractionDirection.OUTBOUND,
      _count: { _all: 2 },
    }]);
    const snapshotAt = new Date('2026-08-12T12:00:00.000Z');

    await expect(
      repository.getDueRelationshipGradeBatch('org', 'integration', snapshotAt)
    ).resolves.toEqual({
      members: [
        { externalId: 'outbound-only', effortScore: 8, reciprocationScore: 0 },
        { externalId: 'zero-activity', effortScore: 0, reciprocationScore: 0 },
      ],
    });
    expect(tx.channelAudienceMember.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: { id: 'asc' },
        take: 100,
        where: expect.objectContaining({
          gradeSnapshots: {
            none: { snapshotAt: { gt: new Date('2026-07-13T12:00:00.000Z') } },
          },
        }),
      })
    );
    expect(groupBy).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        eventAt: {
          gte: new Date('2026-07-13T12:00:00.000Z'),
          lte: snapshotAt,
        },
      }),
    }));
  });

  it('persists historical grade snapshots idempotently for retry safety', async () => {
    const { repository, tx } = createHarness();
    const snapshotAt = new Date('2026-08-12T12:00:00.000Z');

    await repository.createRelationshipGradeSnapshots('org', 'integration', snapshotAt, [{
      externalId: 'person-1',
      effortScore: 0,
      reciprocationScore: 0,
      reciprocity: null,
      grade: null,
      formulaVersion: 1,
    }]);

    expect(tx.channelRelationshipGradeSnapshot.createMany).toHaveBeenCalledWith({
      data: [{
        organizationId: 'org',
        integrationId: 'integration',
        counterpartyExternalId: 'person-1',
        windowStartedAt: new Date('2026-07-13T12:00:00.000Z'),
        snapshotAt,
        effortScore: 0,
        reciprocationScore: 0,
        reciprocity: null,
        grade: null,
        formulaVersion: 1,
      }],
      skipDuplicates: true,
    });
  });
});
