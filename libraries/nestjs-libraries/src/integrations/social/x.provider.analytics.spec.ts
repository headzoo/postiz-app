const userTimeline = jest.fn();
const tweets = jest.fn();
const user = jest.fn();

jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn().mockImplementation(() => ({
    v2: { userTimeline, tweets, user },
  })),
}));

import { XProvider } from '@gitroom/nestjs-libraries/integrations/social/x.provider';

describe('XProvider analytics follower totals', () => {
  const snapshotAt = new Date('2026-08-15T12:00:00.000Z');
  const baseRequest = {
    integration: { internalId: '42' },
    accessToken: 'token:secret',
    snapshotAt,
    fromDay: new Date('2026-08-01T00:00:00.000Z'),
    toDay: new Date('2026-08-15T00:00:00.000Z'),
    pageSize: 10,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    userTimeline.mockResolvedValue({
      data: { data: [{ id: 'tweet-1' }] },
      meta: { next_token: 'next-page' },
    });
    tweets.mockResolvedValue({
      data: [
        {
          id: 'tweet-1',
          public_metrics: {
            impression_count: 10,
            like_count: 2,
            bookmark_count: 1,
            quote_count: 0,
            reply_count: 0,
            retweet_count: 0,
          },
        },
      ],
    });
    user.mockResolvedValue({
      data: { public_metrics: { followers_count: 1500 } },
    });
  });

  it('includes follower accountPoints on the first capture page only', async () => {
    const provider = new XProvider();
    const first = await provider.analyticsSnapshot!.capture(baseRequest);
    expect(user).toHaveBeenCalledWith('42', {
      'user.fields': ['public_metrics'],
    });
    expect(first.accountPoints).toEqual([
      {
        metricKey: 'followers',
        label: 'Followers',
        valueMode: 'latest',
        value: 1500,
        day: '2026-08-15',
      },
    ]);
    expect(first.points.length).toBeGreaterThan(0);

    user.mockClear();
    const second = await provider.analyticsSnapshot!.capture({
      ...baseRequest,
      cursor: 'next-page',
    });
    expect(user).not.toHaveBeenCalled();
    expect(second.accountPoints).toBeUndefined();
  });

  it('keeps post metrics when the follower lookup fails', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    user.mockRejectedValue(new Error('rate limited'));
    const page = await new XProvider().analyticsSnapshot!.capture(baseRequest);
    expect(page.accountPoints).toBeUndefined();
    expect(page.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalPostId: 'tweet-1',
          metricKey: 'like_count',
        }),
      ])
    );
  });
});
