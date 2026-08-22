import { BlueskyProvider } from './bluesky.provider';
import { Integration } from '@prisma/client';

jest.mock('@atproto/api', () => ({
  BskyAgent: jest.fn().mockImplementation(() => ({
    login: jest.fn().mockResolvedValue({}),
    getPostThread: jest.fn(),
    deletePost: jest.fn(),
    repost: jest.fn(),
    post: jest.fn(),
  })),
  AtpAgent: jest.fn(),
  RichText: jest.fn().mockImplementation((opts) => ({
    text: opts.text,
    facets: [],
    detectFacets: jest.fn(),
  })),
}));

describe('BlueskyProvider PostRules Capability', () => {
  let provider: BlueskyProvider;
  let mockIntegration: Integration;
  const mockAccessToken = 'mock_access_token';

  beforeEach(() => {
    provider = new BlueskyProvider();
    mockIntegration = {
      id: 'test-integration-id',
      internalId: 'did:plc:abc123',
      token: mockAccessToken,
      customInstanceDetails: Buffer.from(
        JSON.stringify({
          service: 'https://bsky.social',
          identifier: 'test.bsky.social',
          password: 'test-password',
        })
      ).toString('base64'),
    } as Integration;

    jest.clearAllMocks();
  });

  describe('metadata', () => {
    it('should return correct capability metadata', () => {
      const metadata = provider.postRules.metadata();
      expect(metadata).toEqual({
        actions: {
          remove: true,
          autoRepost: true,
          autoPlug: true,
        },
        metrics: {
          likes: true,
          replies: true,
        },
      });
    });
  });

  describe('loadMetrics', () => {
    it('should successfully load likes and replies count', async () => {
      const mockAgent = {
        login: jest.fn().mockResolvedValue({}),
        getPostThread: jest.fn().mockResolvedValue({
          data: {
            thread: {
              post: {
                likeCount: 42,
                replyCount: 7,
              },
            },
          },
        }),
      };
      jest.spyOn(provider as any, 'getAgent').mockResolvedValue(mockAgent);

      const result = await provider.postRules.loadMetrics(
        mockIntegration,
        mockAccessToken,
        'at://did:plc:abc123/app.bsky.feed.post/xyz'
      );

      expect(result).toEqual({
        status: 'success',
        metrics: {
          likes: 42,
          replies: 7,
        },
      });
    });

    it('should omit replies when not present', async () => {
      const mockAgent = {
        login: jest.fn().mockResolvedValue({}),
        getPostThread: jest.fn().mockResolvedValue({
          data: {
            thread: {
              post: {
                likeCount: 42,
              },
            },
          },
        }),
      };
      jest.spyOn(provider as any, 'getAgent').mockResolvedValue(mockAgent);

      const result = await provider.postRules.loadMetrics(
        mockIntegration,
        mockAccessToken,
        'at://did:plc:abc123/app.bsky.feed.post/xyz'
      );

      expect(result).toEqual({
        status: 'success',
        metrics: {
          likes: 42,
        },
      });
    });

    it('should return not_found for missing post', async () => {
      const mockAgent = {
        login: jest.fn().mockResolvedValue({}),
        getPostThread: jest.fn().mockRejectedValue({ error: 'NotFound' }),
      };
      jest.spyOn(provider as any, 'getAgent').mockResolvedValue(mockAgent);

      const result = await provider.postRules.loadMetrics(
        mockIntegration,
        mockAccessToken,
        'at://did:plc:abc123/app.bsky.feed.post/missing'
      );

      expect(result).toEqual({ status: 'not_found' });
    });

    it('should return auth_error for unauthorized request', async () => {
      const mockAgent = {
        login: jest.fn().mockResolvedValue({}),
        getPostThread: jest.fn().mockRejectedValue({ status: 401 }),
      };
      jest.spyOn(provider as any, 'getAgent').mockResolvedValue(mockAgent);

      const result = await provider.postRules.loadMetrics(
        mockIntegration,
        mockAccessToken,
        'at://did:plc:abc123/app.bsky.feed.post/xyz'
      );

      expect(result).toEqual({ status: 'auth_error' });
    });
  });

  describe('removePost', () => {
    it('should successfully delete a post', async () => {
      const mockAgent = {
        login: jest.fn().mockResolvedValue({}),
        deletePost: jest.fn().mockResolvedValue({}),
      };
      jest.spyOn(provider as any, 'getAgent').mockResolvedValue(mockAgent);

      const result = await provider.postRules.removePost(
        mockIntegration,
        mockAccessToken,
        'at://did:plc:abc123/app.bsky.feed.post/xyz'
      );

      expect(result).toEqual({ status: 'removed' });
      expect(mockAgent.deletePost).toHaveBeenCalledWith(
        'at://did:plc:abc123/app.bsky.feed.post/xyz'
      );
    });

    it('should return already_absent for missing post', async () => {
      const mockAgent = {
        login: jest.fn().mockResolvedValue({}),
        deletePost: jest.fn().mockRejectedValue({ error: 'NotFound' }),
      };
      jest.spyOn(provider as any, 'getAgent').mockResolvedValue(mockAgent);

      const result = await provider.postRules.removePost(
        mockIntegration,
        mockAccessToken,
        'at://did:plc:abc123/app.bsky.feed.post/missing'
      );

      expect(result).toEqual({ status: 'already_absent' });
    });
  });

  describe('repost', () => {
    it('should successfully repost a post', async () => {
      const mockAgent = {
        login: jest.fn().mockResolvedValue({}),
        getPostThread: jest.fn().mockResolvedValue({
          data: {
            thread: {
              post: {
                uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz',
                cid: 'bafyreiabc123',
              },
            },
          },
        }),
        repost: jest.fn().mockResolvedValue({}),
      };
      jest.spyOn(provider as any, 'getAgent').mockResolvedValue(mockAgent);

      const result = await provider.postRules.repost(
        mockIntegration,
        mockAccessToken,
        'at://did:plc:abc123/app.bsky.feed.post/xyz'
      );

      expect(result).toEqual({
        status: 'reposted',
        remoteReleaseId: 'at://did:plc:abc123/app.bsky.feed.post/xyz',
      });
    });

    it('should return already_reposted if already reposted', async () => {
      const mockAgent = {
        login: jest.fn().mockResolvedValue({}),
        getPostThread: jest.fn().mockResolvedValue({
          data: {
            thread: {
              post: {
                uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz',
                cid: 'bafyreiabc123',
              },
            },
          },
        }),
        repost: jest
          .fn()
          .mockRejectedValue({ message: 'Repost already exists' }),
      };
      jest.spyOn(provider as any, 'getAgent').mockResolvedValue(mockAgent);

      const result = await provider.postRules.repost(
        mockIntegration,
        mockAccessToken,
        'at://did:plc:abc123/app.bsky.feed.post/xyz'
      );

      expect(result).toEqual({ status: 'already_reposted' });
    });
  });

  describe('addPlugReply', () => {
    it('should successfully add a reply', async () => {
      const mockAgent = {
        login: jest.fn().mockResolvedValue({}),
        getPostThread: jest.fn().mockResolvedValue({
          data: {
            thread: {
              post: {
                uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz',
                cid: 'bafyreiabc123',
              },
            },
          },
        }),
        post: jest.fn().mockResolvedValue({
          uri: 'at://did:plc:abc123/app.bsky.feed.post/reply123',
        }),
      };
      jest.spyOn(provider as any, 'getAgent').mockResolvedValue(mockAgent);

      const result = await provider.postRules.addPlugReply(
        mockIntegration,
        mockAccessToken,
        'at://did:plc:abc123/app.bsky.feed.post/xyz',
        '<p>Test reply content</p>'
      );

      expect(result).toEqual({
        status: 'added',
        remoteReleaseId: 'at://did:plc:abc123/app.bsky.feed.post/reply123',
      });
    });

    it('should return auth_error for unauthorized reply', async () => {
      const mockAgent = {
        login: jest.fn().mockResolvedValue({}),
        getPostThread: jest.fn().mockResolvedValue({
          data: {
            thread: {
              post: {
                uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz',
                cid: 'bafyreiabc123',
              },
            },
          },
        }),
        post: jest.fn().mockRejectedValue({ status: 403 }),
      };
      jest.spyOn(provider as any, 'getAgent').mockResolvedValue(mockAgent);

      const result = await provider.postRules.addPlugReply(
        mockIntegration,
        mockAccessToken,
        'at://did:plc:abc123/app.bsky.feed.post/xyz',
        'Test content'
      );

      expect(result).toEqual({ status: 'auth_error' });
    });
  });

  describe('legacy compatibility', () => {
    it('should maintain autoRepostPost method with same behavior', async () => {
      const mockAgent = {
        login: jest.fn().mockResolvedValue({}),
        getPostThread: jest
          .fn()
          .mockResolvedValueOnce({
            data: {
              thread: {
                post: {
                  likeCount: 100,
                  uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz',
                  cid: 'bafyreiabc123',
                },
              },
            },
          })
          .mockResolvedValueOnce({
            data: {
              thread: {
                post: {
                  uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz',
                  cid: 'bafyreiabc123',
                },
              },
            },
          }),
        repost: jest.fn().mockResolvedValue({}),
      };
      jest.spyOn(provider as any, 'getAgent').mockResolvedValue(mockAgent);

      const result = await provider.autoRepostPost(
        mockIntegration,
        'at://did:plc:abc123/app.bsky.feed.post/xyz',
        { likesAmount: '50' }
      );

      expect(result).toBe(true);
      expect(mockAgent.repost).toHaveBeenCalled();
    });

    it('should maintain autoPlugPost method with same behavior', async () => {
      const mockAgent = {
        login: jest.fn().mockResolvedValue({}),
        getPostThread: jest
          .fn()
          .mockResolvedValueOnce({
            data: {
              thread: {
                post: {
                  likeCount: 100,
                },
              },
            },
          })
          .mockResolvedValueOnce({
            data: {
              thread: {
                post: {
                  uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz',
                  cid: 'bafyreiabc123',
                },
              },
            },
          }),
        post: jest.fn().mockResolvedValue({
          uri: 'at://did:plc:abc123/app.bsky.feed.post/reply123',
        }),
      };
      jest.spyOn(provider as any, 'getAgent').mockResolvedValue(mockAgent);

      const result = await provider.autoPlugPost(
        mockIntegration,
        'at://did:plc:abc123/app.bsky.feed.post/xyz',
        { likesAmount: '50', post: '<p>Check this out!</p>' }
      );

      expect(result).toBe(true);
      expect(mockAgent.post).toHaveBeenCalled();
    });
  });
});
