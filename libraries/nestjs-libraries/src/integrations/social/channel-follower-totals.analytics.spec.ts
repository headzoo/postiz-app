/**
 * Provider capture smoke tests for channel follower / subscriber totals.
 */
import { FacebookProvider } from '@gitroom/nestjs-libraries/integrations/social/facebook.provider';
import { LinkedinPageProvider } from '@gitroom/nestjs-libraries/integrations/social/linkedin.page.provider';
import { PinterestProvider } from '@gitroom/nestjs-libraries/integrations/social/pinterest.provider';

const snapshotAt = new Date('2026-08-15T12:00:00.000Z');
const dayRange = {
  snapshotAt,
  fromDay: new Date('2026-08-15T00:00:00.000Z'),
  toDay: new Date('2026-08-15T00:00:00.000Z'),
  pageSize: 100,
};

describe('channel follower total analytics captures', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('Facebook includes latest followers from page_follows insights', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            name: 'page_follows',
            values: [{ value: 900, end_time: '2026-08-15T07:00:00+0000' }],
          },
          {
            name: 'page_daily_follows',
            values: [{ value: 3, end_time: '2026-08-15T07:00:00+0000' }],
          },
        ],
      }),
    }) as any;

    const page = await new FacebookProvider().analyticsSnapshot!.capture({
      integration: { internalId: 'page-1' },
      accessToken: 'token',
      ...dayRange,
    } as any);

    expect(page.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricKey: 'followers',
          valueMode: 'latest',
          value: 900,
        }),
        expect.objectContaining({
          metricKey: 'page_followers',
          valueMode: 'sum',
          value: 3,
        }),
      ])
    );
  });

  it('LinkedIn Pages includes latest followers from networkSizes', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('networkSizes')) {
        return {
          ok: true,
          json: async () => ({ firstDegreeSize: 321 }),
        };
      }
      return {
        ok: true,
        json: async () => ({ elements: [] }),
      };
    }) as any;

    const page = await new LinkedinPageProvider().analyticsSnapshot!.capture({
      integration: { internalId: 'org-1' },
      accessToken: 'token',
      ...dayRange,
    } as any);

    expect(page.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricKey: 'followers',
          valueMode: 'latest',
          value: 321,
          day: '2026-08-15',
        }),
      ])
    );
  });

  it('Pinterest includes latest followers from user_account', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/user_account/analytics')) {
        return {
          ok: true,
          json: async () => ({ all: { daily_metrics: [] } }),
        };
      }
      if (String(url).endsWith('/user_account')) {
        return {
          ok: true,
          json: async () => ({ follower_count: 77 }),
        };
      }
      return { ok: false, json: async () => ({}) };
    }) as any;

    const page = await new PinterestProvider().analyticsSnapshot!.capture({
      integration: { internalId: 'user-1' },
      accessToken: 'token',
      ...dayRange,
    } as any);

    expect(page.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricKey: 'followers',
          valueMode: 'latest',
          value: 77,
          day: '2026-08-15',
        }),
      ])
    );
  });
});
