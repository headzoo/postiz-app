import { TumblrProvider } from '@gitroom/nestjs-libraries/integrations/social/tumblr.provider';

const integration = {
  internalId: 'my-blog',
} as any;

describe('TumblrProvider followers', () => {
  const originalClientId = process.env.TUMBLR_CLIENT_ID;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    process.env.TUMBLR_CLIENT_ID = 'tumblr-client';
    process.env.FRONTEND_URL = 'https://postiz.example';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalClientId === undefined) {
      delete process.env.TUMBLR_CLIENT_ID;
    } else {
      process.env.TUMBLR_CLIENT_ID = originalClientId;
    }
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  it('requests the basic scope on new authorization URLs', async () => {
    const provider = new TumblrProvider();
    const auth = await provider.generateAuthUrl();
    const url = new URL(auth.url);

    expect(url.searchParams.get('scope')).toContain('basic');
  });

  it('uses the numeric offset cursor and does not expose updated as followedAt', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            total_users: 25,
            users: [
              {
                name: 'reader',
                url: 'https://reader.tumblr.com/',
                updated: '2026-08-01 12:00:00 GMT',
              },
            ],
          },
        })
      )
    );
    const provider = new TumblrProvider();

    await expect(
      provider.followers(integration, 'access-token', {
        limit: 50,
        cursor: '20',
      })
    ).resolves.toEqual({
      total: 25,
      nextCursor: '21',
      hasMore: true,
      items: [
        {
          id: 'reader',
          name: 'reader',
          profileUrl: 'https://reader.tumblr.com/',
          picture:
            'https://api.tumblr.com/v2/blog/reader.tumblr.com/avatar/128',
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tumblr.com/v2/blog/my-blog/followers?limit=20&offset=20',
      expect.any(Object)
    );
  });

  it('rejects old tokens without the basic scope', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('missing scope', { status: 403 }));
    const provider = new TumblrProvider();

    await expect(
      provider.followers(integration, 'old-access-token', { limit: 1 })
    ).rejects.toThrow();
  });

  it('rejects non-numeric follower cursors', async () => {
    const provider = new TumblrProvider();

    await expect(
      provider.followers(integration, 'access-token', {
        limit: 1,
        cursor: 'https://attacker.example',
      })
    ).rejects.toThrow('Invalid Tumblr follower cursor');
  });
});
