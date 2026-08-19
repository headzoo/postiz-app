import { MastodonProvider } from '@gitroom/nestjs-libraries/integrations/social/mastodon.provider';

describe('MastodonProvider published post edits', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('supports editing published posts with a platform id', () => {
    const provider = new MastodonProvider();
    expect(
      provider.supportsEdit({
        state: 'PUBLISHED',
        publishDate: new Date(),
        releaseId: 'status-1',
      })
    ).toBe(true);
    expect(
      provider.supportsEdit({
        state: 'QUEUE',
        publishDate: new Date(),
        releaseId: 'status-1',
      })
    ).toBe(false);
  });

  it('updates an existing status with PUT /api/v1/statuses/:id', async () => {
    const provider = new MastodonProvider();
    const fetch = jest.spyOn(provider as any, 'fetch').mockResolvedValue({
      json: async () => ({
        id: 'status-1',
        url: 'https://mastodon.social/@me/status-1',
      }),
    });

    await expect(
      provider.editPost(
        'user',
        'token',
        [
          {
            id: 'post-1',
            message: 'Updated status',
            settings: {},
          },
        ],
        {} as any,
        'status-1'
      )
    ).resolves.toEqual([
      {
        id: 'post-1',
        postId: 'status-1',
        releaseURL: 'https://mastodon.social/@me/status-1',
        status: 'completed',
      },
    ]);

    expect(fetch).toHaveBeenCalledWith(
      'https://mastodon.social/api/v1/statuses/status-1',
      expect.objectContaining({
        method: 'PUT',
      })
    );
  });
});
