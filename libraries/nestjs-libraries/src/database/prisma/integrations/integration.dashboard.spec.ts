import { IntegrationService } from './integration.service';
import { RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

jest.mock('@gitroom/nestjs-libraries/redis/redis.service', () => ({
  ioRedis: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

describe('IntegrationService dashboard analytics', () => {
  const org = { id: 'org-a' } as any;
  const social = {
    id: 'social',
    name: 'Social channel',
    picture: null,
    profile: 'channel',
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
      getIntegrationById: jest.fn((_orgId: string, integrationId: string) =>
        integrations.find((integration) => integration.id === integrationId)
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

  it('uses the requesting organization and marks rejected provider analytics unavailable', async () => {
    const supportedAnalytics = jest.fn().mockResolvedValue([]);
    const failingAnalytics = jest.fn().mockRejectedValue(new Error('provider failure'));
    const service = createService([
      social,
      { ...social, id: 'disabled', disabled: true },
      { ...social, id: 'unsupported', providerIdentifier: 'unsupported' },
      { ...social, id: 'failed', providerIdentifier: 'failing' },
      { ...social, id: 'article', type: 'article' },
    ], {
      supported: { analytics: supportedAnalytics },
      failing: { analytics: failingAnalytics },
      unsupported: {},
    });

    await expect(service.getDashboardAnalytics(org, 7)).resolves.toEqual([
      expect.objectContaining({ id: 'social', state: 'ok' }),
      expect.objectContaining({ id: 'disabled', state: 'disabled', analytics: [] }),
      expect.objectContaining({
        id: 'unsupported',
        state: 'unsupported',
        analytics: [],
      }),
      expect.objectContaining({ id: 'failed', state: 'unavailable', analytics: [] }),
      expect.objectContaining({ id: 'article', state: 'unsupported', analytics: [] }),
    ]);
    expect((service as any)._integrationRepository.getIntegrationsList).toHaveBeenCalledWith(
      'org-a'
    );
    expect(failingAnalytics).toHaveBeenCalledWith('social', 'token', 7);
  });

  it('keeps analytics available when a refresh-token retry succeeds', async () => {
    const analytics = jest
      .fn()
      .mockRejectedValueOnce(new RefreshToken('', '{}', {} as any))
      .mockResolvedValueOnce([
        { label: 'Followers', data: [], percentageChange: 0 },
      ]);
    const service = createService([{ ...social, token: 'old-token' }], {
      supported: { analytics },
    });
    (service as any)._refreshIntegrationService.refresh.mockResolvedValue({
      accessToken: 'new-token',
    });

    await expect(service.getDashboardAnalytics(org, 7)).resolves.toEqual([
      expect.objectContaining({
        id: 'social',
        state: 'ok',
        analytics: [{ label: 'Followers', data: [], percentageChange: 0 }],
      }),
    ]);
    expect((service as any)._refreshIntegrationService.refresh).toHaveBeenCalledTimes(1);
    expect(analytics).toHaveBeenNthCalledWith(1, 'social', 'old-token', 7);
    expect(analytics).toHaveBeenNthCalledWith(2, 'social', 'new-token', 7);
  });

  it('filters dashboard analytics to a requested integration', async () => {
    const supportedAnalytics = jest.fn().mockResolvedValue([]);
    const otherAnalytics = jest.fn().mockResolvedValue([]);
    const service = createService(
      [social, { ...social, id: 'other', providerIdentifier: 'other' }],
      {
        supported: { analytics: supportedAnalytics },
        other: { analytics: otherAnalytics },
      }
    );

    await expect(service.getDashboardAnalytics(org, 7, 'social')).resolves.toEqual([
      expect.objectContaining({ id: 'social', state: 'ok' }),
    ]);
    expect(supportedAnalytics).toHaveBeenCalled();
    expect(otherAnalytics).not.toHaveBeenCalled();
  });

  it('returns no dashboard analytics when the requested integration is missing', async () => {
    const supportedAnalytics = jest.fn().mockResolvedValue([]);
    const service = createService([social], {
      supported: { analytics: supportedAnalytics },
    });

    await expect(service.getDashboardAnalytics(org, 7, 'missing')).resolves.toEqual(
      []
    );
    expect(supportedAnalytics).not.toHaveBeenCalled();
  });
});
