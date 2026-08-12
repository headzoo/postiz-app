import { XProvider } from '@gitroom/nestjs-libraries/integrations/social/x.provider';

describe('XProvider followers', () => {
  it('uses the stored user client and normalizes native pagination', async () => {
    const provider = new XProvider();
    const followers = jest.fn().mockResolvedValue({
      data: [
        {
          id: '1',
          name: 'Ada',
          username: 'ada',
          description: 'Builder',
          profile_image_url: 'https://images.x.example/ada.jpg',
          created_at: '2020-01-01T00:00:00.000Z',
          public_metrics: { followers_count: 5, following_count: 3 },
        },
      ],
      meta: { next_token: 'next' },
    });
    jest
      .spyOn(provider as any, 'getClient')
      .mockResolvedValue({ v2: { followers } });

    await expect(
      provider.followers({ internalId: '42' } as any, 'token:secret', {
        limit: 24,
        cursor: 'current',
      })
    ).resolves.toEqual({
      items: [
        {
          id: '1',
          name: 'Ada',
          username: 'ada',
          bio: 'Builder',
          picture: 'https://images.x.example/ada.jpg',
          profileUrl: 'https://x.com/ada',
          followersCount: 5,
          followingCount: 3,
          accountCreatedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      nextCursor: 'next',
      hasMore: true,
    });
    expect(followers).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({ max_results: 24, pagination_token: 'current' })
    );
  });
});
