import { TwitchProvider } from '@gitroom/nestjs-libraries/integrations/social/twitch.provider';

const integration = {
  internalId: 'broadcaster-1',
} as any;

describe('TwitchProvider followers', () => {
  const originalClientId = process.env.TWITCH_CLIENT_ID;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    process.env.TWITCH_CLIENT_ID = 'twitch-client';
    process.env.FRONTEND_URL = 'https://postiz.example';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalClientId === undefined) {
      delete process.env.TWITCH_CLIENT_ID;
    } else {
      process.env.TWITCH_CLIENT_ID = originalClientId;
    }
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  it('requests the follower scope on new authorization URLs', async () => {
    const provider = new TwitchProvider();
    const auth = await provider.generateAuthUrl();
    const url = new URL(auth.url);

    expect(url.searchParams.get('scope')).toContain('moderator:read:followers');
  });

  it('normalizes followers and hydrates all page avatars in one request', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            total: 12,
            data: [
              {
                user_id: 'user-1',
                user_login: 'viewer',
                user_name: 'Viewer Name',
                followed_at: '2026-08-01T12:00:00Z',
              },
            ],
            pagination: { cursor: 'next-page' },
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'user-1',
                profile_image_url: 'https://cdn.twitch.example/viewer.png',
              },
            ],
          })
        )
      );
    const provider = new TwitchProvider();

    await expect(
      provider.followers(integration, 'access-token', {
        limit: 200,
        cursor: 'start-page',
      })
    ).resolves.toEqual({
      total: 12,
      nextCursor: 'next-page',
      hasMore: true,
      items: [
        {
          id: 'user-1',
          name: 'Viewer Name',
          username: 'viewer',
          picture: 'https://cdn.twitch.example/viewer.png',
          profileUrl: 'https://www.twitch.tv/viewer',
          followedAt: '2026-08-01T12:00:00Z',
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.twitch.tv/helix/channels/followers?broadcaster_id=broadcaster-1&first=100&after=start-page'
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.twitch.tv/helix/users?id=user-1'
    );
  });

  it('rejects missing follower scopes without changing token state', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('missing scope', { status: 403 }));
    const provider = new TwitchProvider();

    await expect(
      provider.followers(integration, 'old-access-token', { limit: 1 })
    ).rejects.toThrow();
  });
});
