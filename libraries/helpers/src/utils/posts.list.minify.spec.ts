import { expandPosts, minifyPosts } from './posts.list.minify';

describe('calendar post minify', () => {
  it('round-trips platformDeletedAt', () => {
    const deletedAt = '2026-08-12T13:00:00.000Z';
    const minified = minifyPosts({
      posts: [
        {
          id: 'post-1',
          content: 'Hello',
          publishDate: '2026-08-12T12:00:00.000Z',
          releaseURL: 'https://x.com/i/status/tweet-1',
          releaseId: 'tweet-1',
          state: 'PUBLISHED',
          group: 'g1',
          tags: [],
          integration: {
            id: 'i1',
            providerIdentifier: 'x',
            name: 'X',
            picture: '',
          },
          intervalInDays: null,
          creationMethod: 'PLATFORM',
          platformDeletedAt: deletedAt,
        },
      ],
    });

    expect(minified).toEqual({
      p: [
        expect.objectContaining({
          i: 'post-1',
          cm: 'PLATFORM',
          pd: deletedAt,
        }),
      ],
    });

    expect(expandPosts(minified).posts[0]).toEqual(
      expect.objectContaining({
        id: 'post-1',
        creationMethod: 'PLATFORM',
        platformDeletedAt: deletedAt,
      })
    );
  });
});
