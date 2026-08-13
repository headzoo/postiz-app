import { HttpException } from '@nestjs/common';
import { RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { IntegrationService } from './integration.service';

jest.mock('@gitroom/nestjs-libraries/redis/redis.service', () => ({
  ioRedis: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));
jest.mock(
  '@gitroom/nestjs-libraries/integrations/integration.manager',
  () => ({ IntegrationManager: class IntegrationManager { } })
);

describe('IntegrationService followers', () => {
  const org = { id: 'org-a' } as any;
  const integration = {
    id: 'channel-a',
    name: 'Channel A',
    picture: 'https://example.com/channel.png',
    profile: '@channel',
    providerIdentifier: 'supported',
    disabled: false,
    type: 'social',
    token: 'token',
    tokenExpiration: new Date(Date.now() + 60_000),
  };

  const createService = (integrations: any[], providers: Record<string, any>) => {
    const service = Object.create(IntegrationService.prototype) as IntegrationService;
    (service as any)._integrationRepository = {
      getIntegrationsList: jest.fn().mockResolvedValue(integrations),
      getIntegrationById: jest.fn((orgId: string, integrationId: string) =>
        orgId === org.id
          ? integrations.find((item) => item.id === integrationId)
          : undefined
      ),
    };
    (service as any)._integrationManager = {
      getSocialIntegration: jest.fn((identifier: string) => providers[identifier]),
    };
    (service as any)._refreshIntegrationService = {
      refresh: jest.fn(),
    };
    (service as any)._channelInteractionRepository = {
      getInteractionTracking: jest.fn(),
      getRankedFollowers: jest.fn(),
      getFollowersByNoteCount: jest.fn(),
      getAudienceFollowers: jest.fn(),
      getFollowerInteractionMetrics: jest.fn().mockResolvedValue(new Map()),
      getFollowerNoteCounts: jest.fn().mockResolvedValue(new Map()),
    };
    (service as any)._channelInteractionService = {
      getFollowerDetails: jest.fn(),
      createFollowerNote: jest.fn(),
      updateFollowerNote: jest.fn(),
      deleteFollowerNote: jest.fn(),
    };
    return service;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (ioRedis.get as jest.Mock).mockResolvedValue(null);
    (ioRedis.set as jest.Mock).mockResolvedValue('OK');
  });

  it('returns only eligible, sanitized social channels', async () => {
    const followers = jest.fn().mockResolvedValue({
      items: [{ id: 'follower-a', name: 'Follower A' }],
      hasMore: false,
    });
    const service = createService(
      [
        integration,
        { ...integration, id: 'disabled', disabled: true },
        { ...integration, id: 'article', type: 'article' },
        { ...integration, id: 'unsupported', providerIdentifier: 'unsupported' },
        { ...integration, id: 'empty', providerIdentifier: 'empty' },
        { ...integration, id: 'failing', providerIdentifier: 'failing' },
      ],
      {
        supported: {
          followers,
          followerSorts: [
            {
              key: 'recent',
              label: 'Recent',
              directions: ['desc'],
              defaultDirection: 'desc',
            },
          ],
        },
        unsupported: {},
        empty: { followers: jest.fn().mockResolvedValue({ items: [], hasMore: false }) },
        failing: { followers: jest.fn().mockRejectedValue(new Error('provider body')) },
      }
    );

    await expect(service.getFollowerChannels(org)).resolves.toEqual([
      {
        id: 'channel-a',
        name: 'Channel A',
        picture: 'https://example.com/channel.png',
        display: '@channel',
        identifier: 'supported',
        sorts: [
          {
            key: 'recent',
            label: 'Recent',
            directions: ['desc'],
            defaultDirection: 'desc',
          },
        ],
      },
    ]);
    expect(followers).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'channel-a' }),
      'token',
      { limit: 1 }
    );
    expect(ioRedis.set).toHaveBeenCalledWith(
      'integration:followers:probe:org-a:channel-a',
      '1',
      'EX',
      expect.any(Number)
    );
  });

  it('uses an organization-scoped integration and validates declared sorting', async () => {
    const followers = jest.fn().mockResolvedValue({
      items: [
        {
          id: 'follower-a',
          name: 'Follower A',
          profileUrl: 'javascript:alert(1)',
          picture: 'https://example.com/follower.png',
        },
      ],
      nextCursor: 'opaque-next',
      hasMore: true,
    });
    const service = createService([integration], {
      supported: {
        followers,
        followerSorts: [
          {
            key: 'recent',
            label: 'Recent',
            directions: ['desc'],
            defaultDirection: 'desc',
          },
        ],
      },
    });

    await expect(
      service.getFollowers(org, 'channel-a', {
        limit: 24,
        sort: 'recent',
        direction: 'desc',
      })
    ).resolves.toEqual({
      items: [
        {
          id: 'follower-a',
          name: 'Follower A',
          picture: 'https://example.com/follower.png',
        },
      ],
      nextCursor: 'opaque-next',
      hasMore: true,
    });
    expect(
      (service as any)._integrationRepository.getIntegrationById
    ).toHaveBeenCalledWith('org-a', 'channel-a');
    expect(followers).toHaveBeenCalledWith(
      expect.anything(),
      'token',
      expect.objectContaining({ sort: 'recent', direction: 'desc' })
    );

    await expect(
      service.getFollowers(org, 'channel-a', {
        limit: 24,
        sort: 'recent',
        direction: 'asc',
      })
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      service.getFollowers(org, 'missing', { limit: 24 })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('enriches provider follower pages with interaction metrics', async () => {
    const followers = jest.fn().mockResolvedValue({
      items: [
        { id: 'follower-a', name: 'Follower A' },
        { id: 'follower-b', name: 'Follower B' },
      ],
      hasMore: false,
    });
    const service = createService([integration], {
      supported: {
        followers,
        followerSorts: [
          {
            key: 'recent',
            label: 'Recent',
            directions: ['desc'],
            defaultDirection: 'desc',
          },
        ],
        channelInteractionWebhooks: {
          getInteractionCoverage: (): any[] => [],
        },
      },
    });
    (service as any)._channelInteractionRepository.getFollowerInteractionMetrics.mockResolvedValue(
      new Map([
        [
          'follower-a',
          {
            interactionCount: 23,
            interactionScore: 40,
            lastInteractionAt: new Date('2026-08-12T12:00:00.000Z'),
          },
        ],
      ])
    );

    await expect(
      service.getFollowers(org, 'channel-a', {
        limit: 24,
        sort: 'recent',
        direction: 'desc',
      })
    ).resolves.toEqual({
      items: [
        {
          id: 'follower-a',
          name: 'Follower A',
          interactionCount: 23,
          interactionScore: 40,
          lastInteractionAt: '2026-08-12T12:00:00.000Z',
          noteCount: 0,
        },
        {
          id: 'follower-b',
          name: 'Follower B',
          interactionCount: 0,
          noteCount: 0,
        },
      ],
      hasMore: false,
    });
    expect(
      (service as any)._channelInteractionRepository.getFollowerInteractionMetrics
    ).toHaveBeenCalledWith('org-a', 'channel-a', ['follower-a', 'follower-b']);
  });

  it('sorts page-scoped follower results locally without passing sort to the provider', async () => {
    const followers = jest.fn().mockResolvedValue({
      items: [
        { id: 'low', name: 'Low', followersCount: 10 },
        { id: 'high', name: 'High', followersCount: 100 },
      ],
      hasMore: false,
    });
    const service = createService([integration], {
      supported: {
        followers,
        followerSorts: [
          {
            key: 'recent',
            label: 'Recent',
            directions: ['desc'],
            defaultDirection: 'desc',
            scope: 'native',
          },
          {
            key: 'followers_count',
            label: 'Followers',
            directions: ['asc', 'desc'],
            defaultDirection: 'desc',
            scope: 'page',
          },
        ],
      },
    });

    await expect(
      service.getFollowers(org, 'channel-a', {
        limit: 24,
        sort: 'followers_count',
        direction: 'desc',
      })
    ).resolves.toEqual({
      items: [
        { id: 'high', name: 'High', followersCount: 100 },
        { id: 'low', name: 'Low', followersCount: 10 },
      ],
      hasMore: false,
    });
    expect(followers).toHaveBeenCalledWith(
      expect.anything(),
      'token',
      expect.objectContaining({ limit: 24, sort: undefined, direction: undefined })
    );
  });

  it('refreshes exactly once after a refresh-token failure', async () => {
    const followers = jest
      .fn()
      .mockRejectedValueOnce(new RefreshToken('', '{}', {} as any))
      .mockResolvedValueOnce({ items: [], hasMore: false });
    const service = createService([integration], {
      supported: { followers, followerSorts: [] },
    });
    (service as any)._refreshIntegrationService.refresh.mockResolvedValue({
      accessToken: 'new-token',
    });

    await expect(
      service.getFollowers(org, 'channel-a', { limit: 24 })
    ).resolves.toEqual({ items: [], hasMore: false });
    expect((service as any)._refreshIntegrationService.refresh).toHaveBeenCalledTimes(1);
    expect(followers).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ token: 'new-token' }),
      'new-token',
      { limit: 24 }
    );
  });

  it('returns a sanitized temporary-unavailable error for provider failures', async () => {
    const service = createService([integration], {
      supported: {
        followers: jest.fn().mockRejectedValue(new Error('token=secret provider body')),
      },
    });

    await expect(
      service.getFollowers(org, 'channel-a', { limit: 24 })
    ).rejects.toMatchObject({
      message: 'Followers are temporarily unavailable',
      status: 503,
    });
  });

  it('uses the database-ranked follower path for interaction sorting', async () => {
    const followers = jest.fn();
    const service = createService([integration], {
      supported: {
        followers,
        followerSorts: [],
        channelInteractionWebhooks: {
          getInteractionCoverage: (): any[] => [],
        },
      },
    });
    (service as any)._channelInteractionRepository.getRankedFollowers.mockResolvedValue({
      items: [{
        counterpartyExternalId: 'follower-a',
        interactionCount: 5,
        interactionScore: 14,
        lastInteractionAt: new Date('2026-08-12T12:00:00.000Z'),
        audienceMember: { name: 'Follower A' },
      }],
      hasMore: false,
      rollup: {
        activeGeneration: 'generation-a',
        computedAt: new Date('2026-08-12T12:00:00.000Z'),
      },
      followerSync: {
        activeGeneration: 'followers-a',
        status: 'IN_PROGRESS',
        completedAt: new Date(),
      },
      subscriptions: [{ state: 'ACTIVE' }],
    });

    await expect(
      service.getFollowers(org, 'channel-a', {
        limit: 24,
        sort: 'interactions',
        direction: 'desc',
        window: 'month',
      })
    ).resolves.toMatchObject({
      items: [{
        id: 'follower-a',
        interactionCount: 5,
        interactionScore: 14,
      }],
      window: 'month',
      tracking: { availability: 'ready' },
    });
    expect(followers).not.toHaveBeenCalled();
    expect(
      (service as any)._channelInteractionRepository.getRankedFollowers
    ).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-a',
      integrationId: 'channel-a',
      direction: 'desc',
      limit: 24,
    }));

    await expect(
      service.getFollowers(org, 'channel-a', {
        limit: 24,
        sort: 'interactions',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('uses the database note-count path for notes sorting without a window', async () => {
    const followers = jest.fn();
    const service = createService([integration], {
      supported: {
        followers,
        followerSorts: [],
        channelInteractionWebhooks: {
          getInteractionCoverage: (): any[] => [],
        },
      },
    });
    (
      service as any
    )._channelInteractionRepository.getFollowersByNoteCount.mockResolvedValue({
      items: [
        {
          externalId: 'follower-a',
          name: 'Follower A',
          username: null,
          picture: null,
          profileUrl: null,
          bio: null,
          followersCount: null,
          followingCount: null,
          followedAt: null,
          accountCreatedAt: null,
          noteCount: 3,
        },
      ],
      hasMore: false,
    });

    await expect(
      service.getFollowers(org, 'channel-a', {
        limit: 24,
        sort: 'notes',
        direction: 'desc',
      })
    ).resolves.toMatchObject({
      items: [{ id: 'follower-a', noteCount: 3 }],
      hasMore: false,
    });
    expect(followers).not.toHaveBeenCalled();
    expect(
      (service as any)._channelInteractionRepository.getFollowersByNoteCount
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-a',
        integrationId: 'channel-a',
        direction: 'desc',
        limit: 24,
      })
    );
    expect(
      (service as any)._channelInteractionRepository.getRankedFollowers
    ).not.toHaveBeenCalled();
  });

  it('advertises the Notes database sort for interaction-capable channels', async () => {
    const service = createService([integration], {
      supported: {
        followers: jest.fn().mockResolvedValue({
          items: [{ id: 'follower-a', name: 'Follower A' }],
          hasMore: false,
        }),
        followerSorts: [
          {
            key: 'recent',
            label: 'Recent',
            directions: ['desc'],
            defaultDirection: 'desc',
          },
        ],
        channelInteractionWebhooks: {
          getInteractionCoverage: (): any[] => [],
        },
      },
    });
    (
      service as any
    )._channelInteractionRepository.getInteractionTracking.mockResolvedValue({
      followerSync: null,
      subscriptions: [],
    });

    await expect(service.getFollowerChannels(org)).resolves.toEqual([
      expect.objectContaining({
        id: 'channel-a',
        sorts: expect.arrayContaining([
          expect.objectContaining({ key: 'notes', scope: 'database' }),
          expect.objectContaining({ key: 'interactions', scope: 'database' }),
        ]),
      }),
    ]);
  });

  it('returns unsupported tracking metadata when interaction coverage is absent', async () => {
    const service = createService([integration], {
      supported: {
        followers: jest.fn(),
      },
    });
    (service as any)._channelInteractionService.getFollowerDetails.mockResolvedValue({
      member: {
        externalId: 'follower-a',
        name: 'Follower A',
        username: null,
        picture: null,
        profileUrl: null,
        bio: null,
        followersCount: null,
        followingCount: null,
        followedAt: null,
        accountCreatedAt: null,
      },
      snapshots: [],
      notes: [],
      events: [],
      tracking: {
        followerSync: null,
        subscriptions: [],
      },
    });

    await expect(
      service.getFollowerMemberDetails(org, 'channel-a', 'follower-a')
    ).resolves.toMatchObject({
      tracking: {
        state: 'unsupported',
        availability: 'unavailable',
        noBackfill: true,
        coverage: [],
      },
    });
  });

  it('treats unsupported interaction directions as limited coverage', async () => {
    const service = createService([integration], {
      supported: {
        followers: jest.fn(),
        channelInteractionWebhooks: {
          getInteractionCoverage: () => [
            { kind: 'like', inbound: 'supported', outbound: 'supported' },
            {
              kind: 'repost',
              inbound: 'unsupported',
              outbound: 'supported',
              reason: 'Inbound reposts are not tracked',
            },
          ],
        },
      },
    });
    (service as any)._channelInteractionService.getFollowerDetails.mockResolvedValue({
      member: {
        externalId: 'follower-a',
        name: 'Follower A',
        username: null,
        picture: null,
        profileUrl: null,
        bio: null,
        followersCount: null,
        followingCount: null,
        followedAt: null,
        accountCreatedAt: null,
      },
      snapshots: [],
      notes: [],
      events: [],
      tracking: {
        followerSync: null,
        subscriptions: [{ state: 'ACTIVE' }],
      },
    });

    await expect(
      service.getFollowerMemberDetails(org, 'channel-a', 'follower-a')
    ).resolves.toMatchObject({
      tracking: {
        state: 'partial',
        noBackfill: true,
        coverage: [
          { kind: 'like', inbound: 'supported', outbound: 'supported' },
          {
            kind: 'repost',
            inbound: 'unsupported',
            outbound: 'supported',
            reason: 'Inbound reposts are not tracked',
          },
        ],
      },
    });
  });

  it('returns a sanitized follower member detail payload for an owned follower', async () => {
    const service = createService([integration], {
      supported: {
        followers: jest.fn(),
        channelInteractionWebhooks: {
          getInteractionCoverage: () => [
            { kind: 'like', inbound: 'supported', outbound: 'supported' },
          ],
        },
      },
    });
    (service as any)._channelInteractionService.getFollowerDetails.mockResolvedValue({
      member: {
        externalId: 'follower-a',
        name: 'Follower A',
        username: 'follower',
        picture: 'https://example.com/follower.png',
        profileUrl: 'javascript:alert(1)',
        bio: 'Bio',
        followersCount: 10,
        followingCount: 5,
        followedAt: new Date('2026-01-01T00:00:00.000Z'),
        accountCreatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
      snapshots: [
        {
          snapshotAt: new Date('2026-07-01T00:00:00.000Z'),
          windowStartedAt: new Date('2026-06-01T00:00:00.000Z'),
          effortScore: 4,
          reciprocationScore: 2,
          reciprocity: 0.5,
          grade: 3,
          formulaVersion: 1,
        },
        {
          snapshotAt: new Date('2026-08-01T00:00:00.000Z'),
          windowStartedAt: new Date('2026-07-02T00:00:00.000Z'),
          effortScore: 8,
          reciprocationScore: 8,
          reciprocity: 1,
          grade: 5,
          formulaVersion: 1,
        },
      ],
      notes: [
        {
          id: 'note-a',
          content: 'Team note',
          createdAt: new Date('2026-08-10T12:00:00.000Z'),
          updatedAt: new Date('2026-08-10T12:00:00.000Z'),
          author: {
            id: 'user-a',
            name: 'Alex',
            lastName: 'Author',
            email: 'alex@example.com',
          },
        },
      ],
      events: [
        {
          id: 'event-a',
          kind: 'LIKE',
          direction: 'INBOUND',
          eventAt: new Date('2026-08-11T12:00:00.000Z'),
          relatedObjectId: 'post-a',
        },
      ],
      tracking: {
        followerSync: {
          activeGeneration: 'generation-a',
          status: 'COMPLETED',
          completedAt: new Date('2026-08-01T00:00:00.000Z'),
        },
        subscriptions: [
          {
            state: 'ACTIVE',
            trackingStartedAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        ],
      },
    });

    await expect(
      service.getFollowerMemberDetails(org, 'channel-a', 'follower-a')
    ).resolves.toEqual({
      follower: {
        id: 'follower-a',
        name: 'Follower A',
        username: 'follower',
        picture: 'https://example.com/follower.png',
        bio: 'Bio',
        followersCount: 10,
        followingCount: 5,
        followedAt: '2026-01-01T00:00:00.000Z',
        accountCreatedAt: '2025-01-01T00:00:00.000Z',
      },
      notes: [
        {
          id: 'note-a',
          content: 'Team note',
          author: { id: 'user-a', name: 'Alex Author' },
          createdAt: '2026-08-10T12:00:00.000Z',
          updatedAt: '2026-08-10T12:00:00.000Z',
        },
      ],
      interactions: [
        {
          id: 'event-a',
          kind: 'like',
          direction: 'inbound',
          timestamp: '2026-08-11T12:00:00.000Z',
          relatedObjectId: 'post-a',
        },
      ],
      relationship: {
        windowDays: 30,
        cadenceDays: 30,
        formulaVersion: 1,
        current: {
          snapshotAt: '2026-08-01T00:00:00.000Z',
          windowStartedAt: '2026-07-02T00:00:00.000Z',
          effortScore: 8,
          reciprocationScore: 8,
          reciprocity: 1,
          grade: 5,
          formulaVersion: 1,
        },
        history: [
          {
            snapshotAt: '2026-07-01T00:00:00.000Z',
            windowStartedAt: '2026-06-01T00:00:00.000Z',
            effortScore: 4,
            reciprocationScore: 2,
            reciprocity: 0.5,
            grade: 3,
            formulaVersion: 1,
          },
          {
            snapshotAt: '2026-08-01T00:00:00.000Z',
            windowStartedAt: '2026-07-02T00:00:00.000Z',
            effortScore: 8,
            reciprocationScore: 8,
            reciprocity: 1,
            grade: 5,
            formulaVersion: 1,
          },
        ],
      },
      tracking: {
        state: 'active',
        noBackfill: true,
        trackingStartedAt: '2026-07-01T00:00:00.000Z',
        followerSnapshotAt: '2026-08-01T00:00:00.000Z',
        coverage: [
          { kind: 'like', inbound: 'supported', outbound: 'supported' },
        ],
      },
    });
    expect(
      (service as any)._channelInteractionService.getFollowerDetails
    ).toHaveBeenCalledWith('org-a', 'channel-a', 'follower-a');
  });

  it('treats persisted PARTIAL subscriptions as partial even with full static coverage', async () => {
    const service = createService([integration], {
      supported: {
        followers: jest.fn(),
        channelInteractionWebhooks: {
          getInteractionCoverage: () => [
            { kind: 'like', inbound: 'supported', outbound: 'supported' },
          ],
        },
      },
    });
    (service as any)._channelInteractionService.getFollowerDetails.mockResolvedValue({
      member: {
        externalId: 'follower-a',
        name: 'Follower A',
        username: null,
        picture: null,
        profileUrl: null,
        bio: null,
        followersCount: null,
        followingCount: null,
        followedAt: null,
        accountCreatedAt: null,
      },
      snapshots: [],
      notes: [],
      events: [],
      tracking: {
        followerSync: null,
        subscriptions: [{ state: 'PARTIAL', trackingStartedAt: new Date() }],
      },
    });

    const result = await service.getFollowerMemberDetails(
      org,
      'channel-a',
      'follower-a'
    );
    expect(result.tracking).toMatchObject({
      state: 'partial',
      noBackfill: true,
    });
    expect(result.tracking).not.toHaveProperty('availability');
  });

  it('omits ranking availability for active follower detail tracking', async () => {
    const service = createService([integration], {
      supported: {
        followers: jest.fn(),
        channelInteractionWebhooks: {
          getInteractionCoverage: () => [
            { kind: 'like', inbound: 'supported', outbound: 'supported' },
          ],
        },
      },
    });
    (service as any)._channelInteractionService.getFollowerDetails.mockResolvedValue({
      member: {
        externalId: 'follower-a',
        name: 'Follower A',
        username: null,
        picture: null,
        profileUrl: null,
        bio: null,
        followersCount: null,
        followingCount: null,
        followedAt: null,
        accountCreatedAt: null,
      },
      snapshots: [],
      notes: [],
      events: [],
      tracking: {
        followerSync: {
          activeGeneration: 'generation-a',
          status: 'COMPLETED',
          completedAt: new Date('2026-08-01T00:00:00.000Z'),
        },
        subscriptions: [
          {
            state: 'ACTIVE',
            trackingStartedAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        ],
      },
    });

    const result = await service.getFollowerMemberDetails(
      org,
      'channel-a',
      'follower-a'
    );
    expect(result.tracking).toMatchObject({
      state: 'active',
      noBackfill: true,
      trackingStartedAt: '2026-07-01T00:00:00.000Z',
      followerSnapshotAt: '2026-08-01T00:00:00.000Z',
    });
    expect(result.tracking).not.toHaveProperty('availability');
  });

  it('reports unavailable detail tracking for error and unconfigured subscriptions', async () => {
    const service = createService([integration], {
      supported: {
        followers: jest.fn(),
        channelInteractionWebhooks: {
          getInteractionCoverage: () => [
            { kind: 'like', inbound: 'supported', outbound: 'supported' },
          ],
        },
      },
    });
    const baseDetail = {
      member: {
        externalId: 'follower-a',
        name: 'Follower A',
        username: null,
        picture: null,
        profileUrl: null,
        bio: null,
        followersCount: null,
        followingCount: null,
        followedAt: null,
        accountCreatedAt: null,
      },
      snapshots: [],
      notes: [],
      events: [],
      tracking: {
        followerSync: null,
        subscriptions: [],
      },
    };

    (service as any)._channelInteractionService.getFollowerDetails.mockResolvedValue({
      ...baseDetail,
      tracking: {
        followerSync: null,
        subscriptions: [
          {
            state: 'ERROR',
            failureCategory: 'authentication',
            failureReason: 'raw provider oauth failure',
          },
        ],
      },
    });
    await expect(
      service.getFollowerMemberDetails(org, 'channel-a', 'follower-a')
    ).resolves.toMatchObject({
      tracking: {
        state: 'error',
        availability: 'unavailable',
        failureCategory: 'authentication',
        reason: 'raw provider oauth failure',
      },
    });

    (service as any)._channelInteractionService.getFollowerDetails.mockResolvedValue({
      ...baseDetail,
      tracking: {
        followerSync: null,
        subscriptions: [{ state: 'UNCONFIGURED' }],
      },
    });
    await expect(
      service.getFollowerMemberDetails(org, 'channel-a', 'follower-a')
    ).resolves.toMatchObject({
      tracking: {
        state: 'unconfigured',
        availability: 'unavailable',
      },
    });
  });

  it('rejects follower member detail reads for missing or unavailable integrations', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    const service = createService([integration], {
      supported: { followers: jest.fn() },
    });
    (service as any)._channelInteractionService.getFollowerDetails.mockRejectedValue(
      new NotFoundException('Follower was not found')
    );

    await expect(
      service.getFollowerMemberDetails(org, 'missing', 'follower-a')
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.getFollowerMemberDetails(
        org,
        'channel-a',
        'missing-follower'
      )
    ).rejects.toMatchObject({ status: 404, message: 'Follower was not found' });
  });

  it('creates, updates, and deletes organization-scoped follower notes', async () => {
    const service = createService([integration], {
      supported: { followers: jest.fn() },
    });
    const user = { id: 'user-a' } as any;
    (service as any)._channelInteractionService.createFollowerNote.mockResolvedValue({
      id: 'note-a',
      content: 'Hello',
      createdAt: new Date('2026-08-12T12:00:00.000Z'),
      updatedAt: new Date('2026-08-12T12:00:00.000Z'),
      author: {
        id: 'user-a',
        name: 'Alex',
        lastName: null,
        email: 'alex@example.com',
      },
    });
    (service as any)._channelInteractionService.updateFollowerNote.mockResolvedValue(
      undefined
    );
    (service as any)._channelInteractionService.deleteFollowerNote.mockResolvedValue(
      undefined
    );

    await expect(
      service.createFollowerMemberNote(
        org,
        user,
        'channel-a',
        'follower-a',
        'Hello'
      )
    ).resolves.toEqual({
      id: 'note-a',
      content: 'Hello',
      author: { id: 'user-a', name: 'Alex' },
      createdAt: '2026-08-12T12:00:00.000Z',
      updatedAt: '2026-08-12T12:00:00.000Z',
    });
    await expect(
      service.updateFollowerMemberNote(org, 'channel-a', 'note-a', 'Updated')
    ).resolves.toBeUndefined();
    await expect(
      service.deleteFollowerMemberNote(org, 'channel-a', 'note-a')
    ).resolves.toBeUndefined();
    expect(
      (service as any)._channelInteractionService.createFollowerNote
    ).toHaveBeenCalledWith(
      'org-a',
      'channel-a',
      'follower-a',
      'user-a',
      'Hello'
    );
    expect(
      (service as any)._channelInteractionService.updateFollowerNote
    ).toHaveBeenCalledWith('org-a', 'channel-a', 'note-a', 'Updated');
    expect(
      (service as any)._channelInteractionService.deleteFollowerNote
    ).toHaveBeenCalledWith('org-a', 'channel-a', 'note-a');
  });

  it('falls back to email local-part when note author has no name', async () => {
    const service = createService([integration], {
      supported: { followers: jest.fn() },
    });
    const user = { id: 'user-a' } as any;
    (service as any)._channelInteractionService.createFollowerNote.mockResolvedValue({
      id: 'note-b',
      content: 'Hello',
      createdAt: new Date('2026-08-12T12:00:00.000Z'),
      updatedAt: new Date('2026-08-12T12:00:00.000Z'),
      author: {
        id: 'user-a',
        name: null,
        lastName: null,
        email: 'sean@example.com',
      },
    });

    await expect(
      service.createFollowerMemberNote(
        org,
        user,
        'channel-a',
        'follower-a',
        'Hello'
      )
    ).resolves.toMatchObject({
      author: { id: 'user-a', name: 'Sean' },
    });
  });

  it('returns not found for missing follower notes', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    const service = createService([integration], {
      supported: { followers: jest.fn() },
    });
    (service as any)._channelInteractionService.updateFollowerNote.mockRejectedValue(
      new NotFoundException('Follower note was not found')
    );

    await expect(
      service.updateFollowerMemberNote(org, 'channel-a', 'missing', 'Updated')
    ).rejects.toMatchObject({
      status: 404,
      message: 'Follower note was not found',
    });
  });

  it('searches synced audience members instead of calling the provider', async () => {
    const followers = jest.fn();
    const service = createService([integration], {
      supported: {
        followers,
        followerSorts: [
          {
            key: 'recent',
            label: 'Recent',
            directions: ['desc'],
            defaultDirection: 'desc',
          },
        ],
      },
    });
    (
      service as any
    )._channelInteractionRepository.getAudienceFollowers.mockResolvedValue({
      items: [
        {
          externalId: 'follower-a',
          name: 'Alice',
          username: 'alice',
          picture: null,
          profileUrl: null,
          bio: null,
          followersCount: null,
          followingCount: null,
          followedAt: new Date('2026-08-12T12:00:00.000Z'),
          accountCreatedAt: null,
          noteCount: 0,
        },
      ],
      hasMore: false,
    });

    await expect(
      service.getFollowers(org, 'channel-a', {
        limit: 24,
        sort: 'recent',
        direction: 'desc',
        search: ' @Alice ',
      })
    ).resolves.toMatchObject({
      items: [{ id: 'follower-a', name: 'Alice', username: 'alice' }],
      hasMore: false,
    });
    expect(followers).not.toHaveBeenCalled();
    expect(
      (service as any)._channelInteractionRepository.getAudienceFollowers
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-a',
        integrationId: 'channel-a',
        search: 'Alice',
        sortField: 'followedAt',
        direction: 'desc',
        limit: 24,
      })
    );
  });

  it('treats empty and @-only search as no search', async () => {
    const followers = jest.fn().mockResolvedValue({
      items: [{ id: 'follower-a', name: 'Follower A' }],
      hasMore: false,
    });
    const service = createService([integration], {
      supported: {
        followers,
        followerSorts: [
          {
            key: 'recent',
            label: 'Recent',
            directions: ['desc'],
            defaultDirection: 'desc',
          },
        ],
      },
    });

    await expect(
      service.getFollowers(org, 'channel-a', {
        limit: 24,
        sort: 'recent',
        direction: 'desc',
        search: ' @ ',
      })
    ).resolves.toMatchObject({
      items: [{ id: 'follower-a', name: 'Follower A' }],
    });
    expect(followers).toHaveBeenCalled();
    expect(
      (service as any)._channelInteractionRepository.getAudienceFollowers
    ).not.toHaveBeenCalled();
  });

  it('passes search through the notes database sort', async () => {
    const followers = jest.fn();
    const service = createService([integration], {
      supported: {
        followers,
        followerSorts: [],
        channelInteractionWebhooks: {
          getInteractionCoverage: (): any[] => [],
        },
      },
    });
    (
      service as any
    )._channelInteractionRepository.getFollowersByNoteCount.mockResolvedValue({
      items: [],
      hasMore: false,
    });

    await service.getFollowers(org, 'channel-a', {
      limit: 24,
      sort: 'notes',
      direction: 'desc',
      search: '@alice',
    });

    expect(followers).not.toHaveBeenCalled();
    expect(
      (service as any)._channelInteractionRepository.getFollowersByNoteCount
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'alice',
      })
    );
    expect(
      (service as any)._channelInteractionRepository.getAudienceFollowers
    ).not.toHaveBeenCalled();
  });

  it('passes search through the interactions database sort', async () => {
    const followers = jest.fn();
    const service = createService([integration], {
      supported: {
        followers,
        followerSorts: [],
        channelInteractionWebhooks: {
          getInteractionCoverage: (): any[] => [],
        },
      },
    });
    (
      service as any
    )._channelInteractionRepository.getRankedFollowers.mockResolvedValue({
      items: [],
      hasMore: false,
      rollup: {
        activeGeneration: 'generation-a',
        computedAt: new Date('2026-08-12T12:00:00.000Z'),
      },
      followerSync: {
        activeGeneration: 'followers-a',
        status: 'IN_PROGRESS',
        completedAt: new Date(),
      },
      subscriptions: [{ state: 'ACTIVE' }],
    });

    await service.getFollowers(org, 'channel-a', {
      limit: 24,
      sort: 'interactions',
      direction: 'desc',
      window: 'month',
      search: 'alice',
    });

    expect(followers).not.toHaveBeenCalled();
    expect(
      (service as any)._channelInteractionRepository.getRankedFollowers
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'alice',
      })
    );
    expect(
      (service as any)._channelInteractionRepository.getAudienceFollowers
    ).not.toHaveBeenCalled();
  });

  it('rejects an audience cursor when search is missing', async () => {
    const service = createService([integration], {
      supported: {
        followers: jest.fn(),
        followerSorts: [
          {
            key: 'recent',
            label: 'Recent',
            directions: ['desc'],
            defaultDirection: 'desc',
          },
        ],
      },
    });

    await expect(
      service.getFollowers(org, 'channel-a', {
        limit: 24,
        sort: 'recent',
        direction: 'desc',
        cursor: 'follower-audience:v1:abc',
      })
    ).rejects.toMatchObject({ status: 400 });
  });
});
