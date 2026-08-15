import { ChannelAnalyticsSnapshotActivity } from './channel-analytics-snapshot.activity';
import { RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';

describe('ChannelAnalyticsSnapshotActivity', () => {
  const candidate = { id: 'integration', organizationId: 'organization' };
  const integration = {
    id: candidate.id,
    organizationId: candidate.organizationId,
    type: 'social',
    disabled: false,
    deletedAt: null,
    providerIdentifier: 'provider',
    token: 'token',
    tokenExpiration: null,
  } as any;
  let repository: { listDueCandidates: jest.Mock };
  let analytics: {
    persistCapturePage: jest.Mock;
    finalizeCapture: jest.Mock;
    recordFailure: jest.Mock;
  };
  let integrations: { getIntegrationById: jest.Mock };
  let manager: {
    getAnalyticsSnapshotIntegrations: jest.Mock;
    getSocialIntegration: jest.Mock;
  };
  let refresh: { refresh: jest.Mock };

  const createActivity = () =>
    new ChannelAnalyticsSnapshotActivity(
      repository as any,
      analytics as any,
      integrations as any,
      manager as any,
      refresh as any
    );

  beforeEach(() => {
    repository = { listDueCandidates: jest.fn() };
    analytics = {
      persistCapturePage: jest.fn(),
      finalizeCapture: jest.fn(),
      recordFailure: jest.fn(),
    };
    integrations = {
      getIntegrationById: jest.fn().mockResolvedValue(integration),
    };
    manager = {
      getAnalyticsSnapshotIntegrations: jest.fn().mockReturnValue(['provider']),
      getSocialIntegration: jest.fn(),
    };
    refresh = { refresh: jest.fn() };
  });

  it('discovers only a bounded provider-capable candidate batch', async () => {
    repository.listDueCandidates.mockResolvedValue({
      candidates: [candidate],
    });

    const result = await createActivity().listDueCandidates('before');

    expect(repository.listDueCandidates).toHaveBeenCalledWith(
      ['provider'],
      expect.any(Date),
      'before',
      25
    );
    expect(result.candidates).toEqual([candidate]);
    expect(result.asOf).toEqual(expect.any(String));
  });

  it('persists one provider page and returns pagination metadata only', async () => {
    const capture = jest.fn().mockResolvedValue({
      kind: 'post_lifetime',
      points: [
        {
          externalPostId: 'post',
          metricKey: 'likes',
          label: 'Likes',
          valueMode: 'sum',
          value: 1,
        },
      ],
      nextCursor: 'next',
    });
    manager.getSocialIntegration.mockReturnValue({
      analyticsSnapshot: { capture },
    });

    const result = await createActivity().capturePersistPage({
      candidate,
      snapshotAt: '2026-08-15T12:00:00.000Z',
    });

    expect(analytics.persistCapturePage).toHaveBeenCalledWith(
      candidate.organizationId,
      candidate.id,
      expect.any(Date),
      expect.objectContaining({ kind: 'post_lifetime' })
    );
    expect(result).toEqual({
      mode: 'post_lifetime',
      hasMore: true,
      nextCursor: 'next',
    });
  });

  it('uses a fixed UTC 180-day window for every capture page', async () => {
    const capture = jest.fn().mockResolvedValue({ kind: 'daily', points: [] });
    manager.getSocialIntegration.mockReturnValue({
      analyticsSnapshot: { capture },
    });

    await createActivity().capturePersistPage({
      candidate,
      snapshotAt: '2026-08-15T23:59:59.000Z',
      cursor: '100',
      mode: 'daily',
    });

    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: '100',
        fromDay: new Date('2026-02-17T00:00:00.000Z'),
        toDay: new Date('2026-08-15T00:00:00.000Z'),
        pageSize: 100,
      })
    );
  });

  it('refreshes and retries once when capture requests a new token', async () => {
    const capture = jest
      .fn()
      .mockRejectedValueOnce(new RefreshToken('provider', '{}', ''))
      .mockResolvedValueOnce({ kind: 'daily', points: [] });
    manager.getSocialIntegration.mockReturnValue({
      analyticsSnapshot: { capture },
    });
    refresh.refresh.mockResolvedValue({ accessToken: 'fresh' });

    await createActivity().capturePersistPage({
      candidate,
      snapshotAt: '2026-08-15T12:00:00.000Z',
    });

    expect(refresh.refresh).toHaveBeenCalledWith(integration);
    expect(capture).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ accessToken: 'fresh' })
    );
  });
});
