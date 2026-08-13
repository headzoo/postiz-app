import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  calculateRelationshipGrade,
  ChannelInteractionService,
  getChannelInteractionScore,
} from './channel-interaction.service';

jest.mock(
  '@gitroom/nestjs-libraries/integrations/integration.manager',
  () => ({ IntegrationManager: class IntegrationManager {} })
);

const interaction = (overrides: Record<string, any> = {}) => ({
  providerEventKey: 'provider-event-1',
  kind: 'like',
  direction: 'inbound',
  eventAt: '2026-08-12T12:00:00.000Z',
  counterparty: {
    externalId: 'person-1',
    name: 'Person',
    profileUrl: 'https://social.example/person-1',
  },
  normalizationVersion: 1,
  ...overrides,
});

const createRepository = () => ({
  recordNormalizedEvent: jest.fn().mockResolvedValue({ created: true }),
  applyMembershipUpdate: jest.fn().mockResolvedValue({}),
  beginFollowerSync: jest.fn().mockResolvedValue(undefined),
  applyFollowerSyncPage: jest.fn().mockResolvedValue(true),
  completeFollowerSync: jest.fn().mockResolvedValue(true),
  failFollowerSync: jest.fn().mockResolvedValue(true),
  rebuildWindowSummary: jest.fn().mockResolvedValue({ itemCount: 0 }),
  getActiveIntegrationsForAccount: jest.fn().mockResolvedValue([]),
  requestSubscriptionReconciliation: jest.fn().mockResolvedValue(undefined),
  markSubscriptionsForRemoval: jest.fn().mockResolvedValue({ count: 0 }),
  getDueRelationshipGradeBatch: jest.fn().mockResolvedValue({ members: [] }),
  createRelationshipGradeSnapshots: jest.fn().mockResolvedValue({ count: 0 }),
  hasDueRelationshipGradeMembers: jest.fn().mockResolvedValue(false),
});

describe('ChannelInteractionService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T12:05:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('uses the fixed provider-neutral score matrix', () => {
    expect(getChannelInteractionScore('like', 'inbound')).toBe(2);
    expect(getChannelInteractionScore('like', 'outbound')).toBe(1);
    expect(getChannelInteractionScore('mention', 'inbound')).toBe(4);
    expect(getChannelInteractionScore('mention', 'outbound')).toBe(2);
    expect(getChannelInteractionScore('repost', 'inbound')).toBe(6);
    expect(getChannelInteractionScore('repost', 'outbound')).toBe(3);
    expect(getChannelInteractionScore('reply', 'inbound')).toBe(8);
    expect(getChannelInteractionScore('reply', 'outbound')).toBe(4);
    expect(getChannelInteractionScore('follow', 'inbound')).toBe(10);
    expect(getChannelInteractionScore('follow', 'outbound')).toBe(5);
  });

  it('calculates the version-one relationship grade at its edge cases', () => {
    expect(calculateRelationshipGrade(0, 0)).toEqual({
      reciprocity: null,
      grade: null,
      formulaVersion: 1,
    });
    expect(calculateRelationshipGrade(10, 0)).toEqual({
      reciprocity: 0,
      grade: 1,
      formulaVersion: 1,
    });
    expect(calculateRelationshipGrade(8, 6)).toEqual({
      reciprocity: 0.75,
      grade: 4,
      formulaVersion: 1,
    });
    expect(calculateRelationshipGrade(10, 10)).toEqual({
      reciprocity: 1,
      grade: 5,
      formulaVersion: 1,
    });
    expect(() => calculateRelationshipGrade(-1, 0)).toThrow(RangeError);
  });

  it('creates zero-activity snapshots through the repository batch operation', async () => {
    const repository = createRepository();
    repository.getDueRelationshipGradeBatch.mockResolvedValue({
      members: [{ externalId: 'quiet-follower', effortScore: 0, reciprocationScore: 0 }],
    });
    const service = new ChannelInteractionService(repository as any);
    const snapshotAt = new Date('2026-08-12T12:00:00.000Z');

    await expect(
      service.buildRelationshipGradeSnapshotBatch('org', 'integration', snapshotAt)
    ).resolves.toEqual({ snapshotAt, processed: 1, hasMore: false });
    expect(repository.createRelationshipGradeSnapshots).toHaveBeenCalledWith(
      'org',
      'integration',
      snapshotAt,
      [{
        externalId: 'quiet-follower',
        effortScore: 0,
        reciprocationScore: 0,
        reciprocity: null,
        grade: null,
        formulaVersion: 1,
      }]
    );
  });

  it('records normalized events and reports duplicate deliveries', async () => {
    const repository = createRepository();
    repository.recordNormalizedEvent
      .mockResolvedValueOnce({ created: true })
      .mockResolvedValueOnce({ created: false });
    const service = new ChannelInteractionService(repository as any);

    const result = await service.recordNormalizedDelivery('org', 'integration', [
      interaction(),
      interaction({ providerEventKey: 'provider-event-2' }),
    ] as any);

    expect(result).toEqual({ created: 1, duplicates: 1, membershipOnly: 0 });
    expect(repository.recordNormalizedEvent).toHaveBeenNthCalledWith(
      1,
      'org',
      'integration',
      expect.objectContaining({
        kind: 'LIKE',
        direction: 'INBOUND',
        score: 2,
      })
    );
  });

  it('applies unfollow membership immediately without logging a positive event', async () => {
    const repository = createRepository();
    const service = new ChannelInteractionService(repository as any);

    const result = await service.recordNormalizedDelivery('org', 'integration', [
      interaction({
        kind: 'follow',
        membershipUpdate: 'not_follower',
      }),
    ] as any);

    expect(result).toEqual({ created: 0, duplicates: 0, membershipOnly: 1 });
    expect(repository.applyMembershipUpdate).toHaveBeenCalledWith(
      'org',
      'integration',
      expect.objectContaining({ externalId: 'person-1' }),
      'NOT_FOLLOWER'
    );
    expect(repository.recordNormalizedEvent).not.toHaveBeenCalled();
  });

  it('does not let an unknown membership signal demote a known follower', async () => {
    const repository = createRepository();
    const service = new ChannelInteractionService(repository as any);

    await service.recordNormalizedDelivery('org', 'integration', [
      interaction({ membershipUpdate: 'unknown' }),
    ] as any);

    expect(repository.recordNormalizedEvent).toHaveBeenCalledWith(
      'org',
      'integration',
      expect.objectContaining({ membershipUpdate: undefined })
    );
  });

  it('validates a complete batch before performing any writes', async () => {
    const repository = createRepository();
    const service = new ChannelInteractionService(repository as any);

    await expect(
      service.recordNormalizedDelivery('org', 'integration', [
        interaction(),
        interaction({ providerEventKey: '', kind: 'invented' }),
      ] as any)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.recordNormalizedEvent).not.toHaveBeenCalled();
  });

  it('rejects unsafe metadata, URLs, and future timestamps', async () => {
    const repository = createRepository();
    const service = new ChannelInteractionService(repository as any);

    await expect(
      service.recordNormalizedDelivery('org', 'integration', [
        interaction({ metadata: { secret: 'x'.repeat(2049) } }),
      ] as any)
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.recordNormalizedDelivery('org', 'integration', [
        interaction({ counterparty: { externalId: 'p', picture: 'file:///etc/passwd' } }),
      ] as any)
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.recordNormalizedDelivery('org', 'integration', [
        interaction({ eventAt: '2026-08-12T13:00:00.000Z' }),
      ] as any)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects stale follower generations without completing or applying them', async () => {
    const repository = createRepository();
    repository.applyFollowerSyncPage.mockResolvedValue(false);
    repository.completeFollowerSync.mockResolvedValue(false);
    const service = new ChannelInteractionService(repository as any);

    await expect(
      service.applyFollowerSync('org', 'integration', 'stale', [])
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.completeFollowerSync('org', 'integration', 'stale')
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses exact inclusive UTC-instant cutoffs for all rolling windows', async () => {
    const repository = createRepository();
    const service = new ChannelInteractionService(repository as any);
    const computedAt = new Date('2026-08-12T18:30:00.000Z');

    for (const [window, cutoff] of [
      ['week', '2026-08-05T18:30:00.000Z'],
      ['month', '2026-07-13T18:30:00.000Z'],
      ['90_day', '2026-05-14T18:30:00.000Z'],
      ['year', '2025-08-12T18:30:00.000Z'],
    ] as const) {
      await service.rebuildWindowSummary('org', 'integration', window, computedAt);
      expect(repository.rebuildWindowSummary).toHaveBeenLastCalledWith(
        'org',
        'integration',
        expect.any(String),
        expect.any(String),
        new Date(cutoff),
        computedAt
      );
    }
  });

  it('fans a verified delivery out to every active matching integration', async () => {
    const repository = createRepository();
    repository.getActiveIntegrationsForAccount.mockResolvedValue([
      { id: 'integration-a', organizationId: 'org-a' },
      { id: 'integration-b', organizationId: 'org-b' },
    ]);
    const capability = {
      verifyAndNormalizeDelivery: jest.fn().mockResolvedValue({
        accepted: true,
        connectedAccountId: 'account-1',
        events: [interaction()],
      }),
    };
    const manager = {
      getSocialIntegration: jest.fn().mockReturnValue({
        channelInteractionWebhooks: capability,
      }),
    };
    const service = new ChannelInteractionService(repository as any, manager as any);
    const record = jest.spyOn(service, 'recordNormalizedDelivery').mockResolvedValue({
      created: 1,
      duplicates: 0,
      membershipOnly: 0,
    });

    await expect(
      service.handleDelivery('provider', {
        rawBody: Buffer.from('{}'),
        headers: {},
      })
    ).resolves.toEqual(expect.objectContaining({ accepted: true }));
    expect(repository.getActiveIntegrationsForAccount).toHaveBeenCalledWith(
      'provider',
      'account-1'
    );
    expect(record).toHaveBeenCalledWith('org-a', 'integration-a', [interaction()]);
    expect(record).toHaveBeenCalledWith('org-b', 'integration-b', [interaction()]);
  });

  it('writes an inbound webhook log for each resolved organization', async () => {
    const repository = createRepository();
    repository.getActiveIntegrationsForAccount.mockResolvedValue([
      { id: 'integration-a', organizationId: 'org-a' },
      { id: 'integration-a2', organizationId: 'org-a' },
      { id: 'integration-b', organizationId: 'org-b' },
    ]);
    const logsService = {
      logInboundWebhook: jest.fn().mockResolvedValue(undefined),
    };
    const manager = {
      getSocialIntegration: jest.fn().mockReturnValue({
        channelInteractionWebhooks: {
          verifyAndNormalizeDelivery: jest.fn().mockResolvedValue({
            accepted: true,
            connectedAccountId: 'account-1',
            events: [interaction()],
          }),
        },
      }),
    };
    const service = new ChannelInteractionService(
      repository as any,
      manager as any,
      logsService as any
    );
    jest.spyOn(service, 'recordNormalizedDelivery').mockResolvedValue({
      created: 1,
      duplicates: 0,
      membershipOnly: 0,
    });

    await service.handleDelivery('provider', {
      rawBody: Buffer.from('{"ok":true}'),
      headers: { 'x-twitter-webhooks-signature': 'valid' },
    });

    expect(logsService.logInboundWebhook).toHaveBeenCalledTimes(2);
    expect(logsService.logInboundWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-a',
        method: 'POST',
        url: '/channel-webhooks/provider',
        statusCode: 200,
      })
    );
    expect(logsService.logInboundWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-b',
        method: 'POST',
        url: '/channel-webhooks/provider',
        statusCode: 200,
      })
    );
  });

  it('acknowledges a verified delivery for an unknown local account', async () => {
    const repository = createRepository();
    const manager = {
      getSocialIntegration: jest.fn().mockReturnValue({
        channelInteractionWebhooks: {
          verifyAndNormalizeDelivery: jest.fn().mockResolvedValue({
            accepted: true,
            connectedAccountId: 'missing-account',
            events: [],
          }),
        },
      }),
    };
    const service = new ChannelInteractionService(repository as any, manager as any);

    await expect(
      service.handleDelivery('provider', {
        rawBody: Buffer.from('{}'),
        headers: {},
      })
    ).resolves.toEqual(expect.objectContaining({ accepted: true }));
    expect(repository.getActiveIntegrationsForAccount).toHaveBeenCalledWith(
      'provider',
      'missing-account'
    );
  });

  it('requests provisioning on reconnect and removal on disable/delete', async () => {
    const repository = createRepository();
    const manager = {
      getSocialIntegration: jest.fn().mockReturnValue({
        channelInteractionWebhooks: {
          getDesiredSubscriptions: jest.fn().mockReturnValue([
            { eventKey: 'like', direction: 'inbound' },
          ]),
        },
      }),
    };
    const service = new ChannelInteractionService(repository as any, manager as any);
    const integration = {
      id: 'integration-a',
      organizationId: 'org-a',
      providerIdentifier: 'provider',
      type: 'social',
    };

    await expect(
      service.requestReconciliation(integration as any)
    ).resolves.toBe(true);
    expect(repository.requestSubscriptionReconciliation).toHaveBeenCalledWith(
      'org-a',
      'integration-a',
      [{ eventKey: 'like', direction: 'INBOUND' }]
    );

    await expect(
      service.requestSubscriptionRemoval(integration as any)
    ).resolves.toBe(true);
    expect(repository.markSubscriptionsForRemoval).toHaveBeenCalledWith(
      'org-a',
      'integration-a'
    );
  });
});
