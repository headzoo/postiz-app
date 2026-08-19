import {
  XProvider,
  X_EDIT_WINDOW_MINUTES,
} from '@gitroom/nestjs-libraries/integrations/social/x.provider';

describe('XProvider published post edits', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('allows edits within the 30-minute window', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-19T12:00:00.000Z'));
    const provider = new XProvider();

    expect(
      provider.supportsEdit({
        state: 'PUBLISHED',
        publishDate: new Date('2026-08-19T11:45:00.000Z'),
        releaseId: 'tweet-1',
        settings: '{}',
      })
    ).toBe(true);
    expect(X_EDIT_WINDOW_MINUTES).toBe(30);
  });

  it('rejects edits after the 30-minute window, articles, and missing ids', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-19T12:00:00.000Z'));
    const provider = new XProvider();

    expect(
      provider.supportsEdit({
        state: 'PUBLISHED',
        publishDate: new Date('2026-08-19T11:29:00.000Z'),
        releaseId: 'tweet-1',
      })
    ).toBe(false);
    expect(
      provider.supportsEdit({
        state: 'PUBLISHED',
        publishDate: new Date('2026-08-19T11:45:00.000Z'),
        releaseId: 'tweet-1',
        settings: JSON.stringify({ post_type: 'article' }),
      })
    ).toBe(false);
    expect(
      provider.supportsEdit({
        state: 'PUBLISHED',
        publishDate: new Date('2026-08-19T11:45:00.000Z'),
        releaseId: 'missing',
      })
    ).toBe(false);
  });

  it('sends edit_options.previous_post_id when editing a tweet', async () => {
    const provider = new XProvider();
    jest.spyOn(provider as any, 'getClient').mockResolvedValue({});
    jest.spyOn(provider as any, 'uploadMedia').mockResolvedValue({
      'post-1': ['media-1'],
    });
    jest.spyOn(provider as any, 'signOAuth1').mockReturnValue('oauth');
    const fetch = jest.spyOn(provider as any, 'fetch').mockResolvedValue({
      json: async () => ({ data: { id: 'new-tweet' } }),
    });

    await expect(
      provider.editPost(
        'user',
        'token:secret',
        [
          {
            id: 'post-1',
            message: '<p>Hello world</p>',
            settings: {},
          },
        ],
        { profile: 'me' } as any,
        'old-tweet'
      )
    ).resolves.toEqual([
      {
        postId: 'new-tweet',
        id: 'post-1',
        releaseURL: 'https://twitter.com/me/status/new-tweet',
        status: 'posted',
      },
    ]);

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        edit_options: { previous_post_id: 'old-tweet' },
        text: 'Hello world',
        media: { media_ids: ['media-1'] },
      })
    );
  });
});
