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
});
