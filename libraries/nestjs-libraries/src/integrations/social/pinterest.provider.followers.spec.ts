import { PinterestProvider } from '@gitroom/nestjs-libraries/integrations/social/pinterest.provider';

describe('PinterestProvider followers', () => {
  it('forwards bookmarks and normalizes UserSummary fields', async () => {
    const provider = new PinterestProvider();
    const fetch = jest.spyOn(provider as any, 'fetch').mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        items: [
          { username: 'pinfollower', type: 'user' },
          { username: 'anotheruser', type: 'user' },
        ],
        bookmark: 'next-bookmark',
      }),
    });

    const page = await provider.followers({} as any, 'token', {
      limit: 24,
      cursor: 'current-bookmark',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.pinterest.com/v5/user_account/followers?page_size=24&bookmark=current-bookmark',
      { method: 'GET', headers: { Authorization: 'Bearer token' } }
    );
    expect(page).toEqual({
      items: [
        {
          id: 'pinfollower',
          name: 'pinfollower',
          username: 'pinfollower',
          profileUrl: 'https://www.pinterest.com/pinfollower',
        },
        {
          id: 'anotheruser',
          name: 'anotheruser',
          username: 'anotheruser',
          profileUrl: 'https://www.pinterest.com/anotheruser',
        },
      ],
      nextCursor: 'next-bookmark',
      hasMore: true,
    });
  });

  it('skips malformed entries without usernames', async () => {
    const provider = new PinterestProvider();
    jest.spyOn(provider as any, 'fetch').mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        items: [
          { type: 'user' },
          { username: '', type: 'user' },
          { username: 'validuser', type: 'user' },
        ],
      }),
    });

    const page = await provider.followers({} as any, 'token', { limit: 24 });

    expect(page.items).toEqual([
      {
        id: 'validuser',
        name: 'validuser',
        username: 'validuser',
        profileUrl: 'https://www.pinterest.com/validuser',
      },
    ]);
    expect(page.hasMore).toBe(false);
  });

  it('returns an empty terminal page without a bookmark', async () => {
    const provider = new PinterestProvider();
    jest.spyOn(provider as any, 'fetch').mockResolvedValue({
      json: jest.fn().mockResolvedValue({ items: [] }),
    });

    await expect(
      provider.followers({} as any, 'token', { limit: 24 })
    ).resolves.toEqual({ items: [], hasMore: false });
  });
});
