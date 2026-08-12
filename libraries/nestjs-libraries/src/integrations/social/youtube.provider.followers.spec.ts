const setCredentials = jest.fn();
const subscriptionsList = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(() => ({ setCredentials })),
    },
    youtube: jest.fn(() => ({
      subscriptions: { list: subscriptionsList },
    })),
    oauth2: jest.fn(),
    youtubeAnalytics: jest.fn(),
  },
}));

import { YoutubeProvider } from '@gitroom/nestjs-libraries/integrations/social/youtube.provider';

describe('YoutubeProvider followers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only public subscribers through mySubscribers and preserves tokens', async () => {
    subscriptionsList.mockResolvedValue({
      data: {
        items: [
          {
            subscriberSnippet: {
              channelId: 'subscriber-channel',
              title: 'Public subscriber',
              description: 'Public profile',
              thumbnails: {
                medium: { url: 'https://img.example/subscriber.jpg' },
              },
            },
          },
        ],
        pageInfo: { totalResults: 1 },
        nextPageToken: 'next-page',
        prevPageToken: 'previous-page',
      },
    });

    const page = await new YoutubeProvider().followers({} as any, 'token', {
      limit: 100,
      cursor: 'current-page',
      sort: 'alphabetical',
      direction: 'asc',
    });

    expect(setCredentials).toHaveBeenCalledWith({ access_token: 'token' });
    expect(subscriptionsList).toHaveBeenCalledWith({
      part: ['subscriberSnippet'],
      mySubscribers: true,
      maxResults: 50,
      pageToken: 'current-page',
      order: 'alphabetical',
    });
    expect(page).toEqual({
      items: [
        {
          id: 'subscriber-channel',
          name: 'Public subscriber',
          bio: 'Public profile',
          picture: 'https://img.example/subscriber.jpg',
          profileUrl: 'https://www.youtube.com/channel/subscriber-channel',
        },
      ],
      total: 1,
      nextCursor: 'next-page',
      previousCursor: 'previous-page',
      hasMore: true,
    });
  });
});
