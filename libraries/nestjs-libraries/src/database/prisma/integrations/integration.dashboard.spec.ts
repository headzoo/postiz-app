jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class IntegrationManager {},
  socialIntegrationList: [],
}));

import { IntegrationService } from './integration.service';
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
    picture: null as string | null,
    profile: 'channel',
    providerIdentifier: 'supported',
    disabled: false,
    type: 'social',
    token: 'token',
    tokenExpiration: new Date(Date.now() + 60_000),
  };

  const createService = (
    integrations: any[],
    providers: Record<string, any>,
    analyticsMocks?: {
      getStoredAnalytics?: jest.Mock;
      getSyncState?: jest.Mock;
      isChannelUnavailable?: jest.Mock;
    }
  ) => {
    const service = Object.create(IntegrationService.prototype) as IntegrationService;
    (service as any)._integrationRepository = {
      getIntegrationsList: jest.fn().mockResolvedValue(integrations),
    };
    (service as any)._integrationManager = {
      getSocialIntegration: jest.fn((identifier: string) => providers[identifier]),
    };
    (service as any)._channelAnalyticsService = {
      getStoredAnalytics:
        analyticsMocks?.getStoredAnalytics ||
        jest.fn().mockResolvedValue([]),
      isChannelUnavailable:
        analyticsMocks?.isChannelUnavailable ||
        jest.fn().mockReturnValue(false),
    };
    (service as any)._channelAnalyticsRepository = {
      getSyncState:
        analyticsMocks?.getSyncState || jest.fn().mockResolvedValue(null),
    };
    return service;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (ioRedis.get as jest.Mock).mockResolvedValue(null);
    (ioRedis.set as jest.Mock).mockResolvedValue('OK');
  });

  it('uses stored analytics and never calls providers or legacy Redis keys', async () => {
    const getStoredAnalytics = jest.fn().mockResolvedValue([
      {
        label: 'Impressions',
        valueMode: 'sum',
        data: [{ date: '2026-08-08', total: 4 }],
      },
    ]);
    const supportedAnalytics = jest.fn();
    const service = createService(
      [
        social,
        { ...social, id: 'disabled', disabled: true },
        { ...social, id: 'unsupported', providerIdentifier: 'unsupported' },
        { ...social, id: 'legacy-only', providerIdentifier: 'legacy' },
        { ...social, id: 'article', type: 'article' },
      ],
      {
        supported: { analyticsSnapshot: { capture: jest.fn() }, analytics: supportedAnalytics },
        legacy: { analytics: supportedAnalytics },
        unsupported: {},
      },
      { getStoredAnalytics }
    );

    await expect(service.getDashboardAnalytics(org, 7)).resolves.toEqual([
      expect.objectContaining({
        id: 'social',
        state: 'ok',
        analytics: [
          {
            label: 'Impressions',
            valueMode: 'sum',
            data: [{ date: '2026-08-08', total: 4 }],
          },
        ],
      }),
      expect.objectContaining({ id: 'disabled', state: 'disabled', analytics: [] }),
      expect.objectContaining({
        id: 'unsupported',
        state: 'unsupported',
        analytics: [],
      }),
      expect.objectContaining({ id: 'legacy-only', state: 'unsupported', analytics: [] }),
      expect.objectContaining({ id: 'article', state: 'unsupported', analytics: [] }),
    ]);
    expect((service as any)._integrationRepository.getIntegrationsList).toHaveBeenCalledWith(
      'org-a'
    );
    expect(getStoredAnalytics).toHaveBeenCalledWith('org-a', 'social', 7);
    expect(supportedAnalytics).not.toHaveBeenCalled();
    expect(ioRedis.get).not.toHaveBeenCalled();
    expect(ioRedis.set).not.toHaveBeenCalled();
  });

  it('marks channels unavailable when capture never succeeded after scheduler failure', async () => {
    const getStoredAnalytics = jest.fn();
    const isChannelUnavailable = jest.fn().mockReturnValue(true);
    const getSyncState = jest.fn().mockResolvedValue({
      failureCount: 2,
      lastSuccessfulSnapshotAt: null,
    });
    const service = createService(
      [social],
      {
        supported: { analyticsSnapshot: { capture: jest.fn() } },
      },
      { getStoredAnalytics, isChannelUnavailable, getSyncState }
    );

    await expect(service.getDashboardAnalytics(org, 7)).resolves.toEqual([
      expect.objectContaining({ id: 'social', state: 'unavailable', analytics: [] }),
    ]);
    expect(getStoredAnalytics).not.toHaveBeenCalled();
    expect(getSyncState).toHaveBeenCalledWith('org-a', 'social');
  });

  it('filters dashboard analytics to a requested integration', async () => {
    const getStoredAnalytics = jest.fn().mockResolvedValue([]);
    const service = createService(
      [social, { ...social, id: 'other', providerIdentifier: 'other' }],
      {
        supported: { analyticsSnapshot: { capture: jest.fn() } },
        other: { analyticsSnapshot: { capture: jest.fn() } },
      },
      { getStoredAnalytics }
    );

    await expect(service.getDashboardAnalytics(org, 7, 'social')).resolves.toEqual([
      expect.objectContaining({ id: 'social', state: 'ok' }),
    ]);
    expect(getStoredAnalytics).toHaveBeenCalledTimes(1);
    expect(getStoredAnalytics).toHaveBeenCalledWith('org-a', 'social', 7);
  });

  it('returns no dashboard analytics when the requested integration is missing', async () => {
    const getStoredAnalytics = jest.fn();
    const service = createService([social], {
      supported: { analyticsSnapshot: { capture: jest.fn() } },
    }, { getStoredAnalytics });

    await expect(service.getDashboardAnalytics(org, 7, 'missing')).resolves.toEqual(
      []
    );
    expect(getStoredAnalytics).not.toHaveBeenCalled();
  });
});
