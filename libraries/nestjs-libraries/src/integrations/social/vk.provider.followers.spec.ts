import { VkProvider } from '@gitroom/nestjs-libraries/integrations/social/vk.provider';

describe('VkProvider followers', () => {
  it('uses an opaque offset cursor and returns VK recent-first pages', async () => {
    const provider = new VkProvider();
    const fetch = jest.spyOn(provider as any, 'fetch').mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        response: {
          count: 3,
          items: [
            {
              id: 11,
              first_name: 'VK',
              last_name: 'Follower',
              screen_name: 'vkfollower',
              photo_200: 'https://vk.example/follower.jpg',
              status: 'About me',
              counters: { followers: 7 },
            },
          ],
        },
      }),
    });
    const cursor = Buffer.from(JSON.stringify({ offset: 1 })).toString(
      'base64url'
    );

    const page = await provider.followers(
      { internalId: 'owner-1' } as any,
      'token',
      { limit: 200, cursor }
    );

    const request = new URL(fetch.mock.calls[0][0]);
    expect(request.origin + request.pathname).toBe(
      'https://api.vk.com/method/users.getFollowers'
    );
    expect(Object.fromEntries(request.searchParams)).toMatchObject({
      user_id: 'owner-1',
      offset: '1',
      count: '100',
      v: '5.251',
    });
    expect(page).toMatchObject({
      total: 3,
      hasMore: true,
      items: [
        {
          id: '11',
          name: 'VK Follower',
          profileUrl: 'https://vk.com/vkfollower',
          followersCount: 7,
        },
      ],
    });
    expect(Buffer.from(page.nextCursor!, 'base64url').toString('utf8')).toBe(
      '{"offset":2}'
    );
  });

  it('does not create a next page for an empty response', async () => {
    const provider = new VkProvider();
    jest.spyOn(provider as any, 'fetch').mockResolvedValue({
      json: jest.fn().mockResolvedValue({ response: { count: 0, items: [] } }),
    });

    await expect(
      provider.followers({ internalId: 'owner-1' } as any, 'token', {
        limit: 24,
      })
    ).resolves.toEqual({ items: [], total: 0, hasMore: false });
  });
});
