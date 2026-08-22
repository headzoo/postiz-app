import { LinkedinPageProvider } from './linkedin.page.provider';
import { Integration } from '@prisma/client';

describe('LinkedinPageProvider PostRules Capability', () => {
  let provider: LinkedinPageProvider;
  let mockIntegration: Integration;
  const mockAccessToken = 'mock_access_token';

  beforeEach(() => {
    provider = new LinkedinPageProvider();
    mockIntegration = {
      id: 'test-integration-id',
      internalId: '12345678',
      token: mockAccessToken,
    } as Integration;

    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('metadata', () => {
    it('should return correct capability metadata', () => {
      const metadata = provider.postRules.metadata();
      expect(metadata).toEqual({
        actions: {
          remove: true,
          autoRepost: true,
          autoPlug: true,
          notify: true,
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
      const mockFetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          likesSummary: { totalLikes: 75 },
          commentsSummary: { totalFirstLevelComments: 12 },
        }),
      });
      (global.fetch as jest.Mock) = mockFetch;
      provider['fetch'] = mockFetch;

      const result = await provider.postRules.loadMetrics(
        mockIntegration,
        mockAccessToken,
        'urn:li:share:123'
      );

      expect(result).toEqual({
        status: 'success',
        metrics: {
          likes: 75,
          replies: 12,
        },
      });
    });

    it('should omit replies when not present', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          likesSummary: { totalLikes: 75 },
        }),
      });
      provider['fetch'] = mockFetch;

      const result = await provider.postRules.loadMetrics(
        mockIntegration,
        mockAccessToken,
        'urn:li:share:123'
      );

      expect(result).toEqual({
        status: 'success',
        metrics: {
          likes: 75,
        },
      });
    });

    it('should return not_found for missing post', async () => {
      const mockFetch = jest.fn().mockRejectedValue({ status: 404 });
      provider['fetch'] = mockFetch;

      const result = await provider.postRules.loadMetrics(
        mockIntegration,
        mockAccessToken,
        'urn:li:share:missing'
      );

      expect(result).toEqual({ status: 'not_found' });
    });

    it('should return auth_error for unauthorized request', async () => {
      const mockFetch = jest.fn().mockRejectedValue({ status: 401 });
      provider['fetch'] = mockFetch;

      const result = await provider.postRules.loadMetrics(
        mockIntegration,
        mockAccessToken,
        'urn:li:share:123'
      );

      expect(result).toEqual({ status: 'auth_error' });
    });
  });

  describe('removePost', () => {
    it('should successfully delete a post', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({}),
      });
      provider['fetch'] = mockFetch;

      const result = await provider.postRules.removePost(
        mockIntegration,
        mockAccessToken,
        'urn:li:share:123'
      );

      expect(result).toEqual({ status: 'removed' });
    });

    it('should return already_absent for missing post', async () => {
      const mockFetch = jest.fn().mockRejectedValue({ status: 404 });
      provider['fetch'] = mockFetch;

      const result = await provider.postRules.removePost(
        mockIntegration,
        mockAccessToken,
        'urn:li:share:missing'
      );

      expect(result).toEqual({ status: 'already_absent' });
    });
  });

  describe('repost', () => {
    it('should successfully reshare a post', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({}),
      });
      provider['fetch'] = mockFetch;

      const result = await provider.postRules.repost(
        mockIntegration,
        mockAccessToken,
        'urn:li:share:123'
      );

      expect(result).toEqual({
        status: 'reposted',
        remoteReleaseId: 'urn:li:share:123',
      });
    });

    it('should return auth_error for unauthorized reshare', async () => {
      const mockFetch = jest.fn().mockRejectedValue({ status: 403 });
      provider['fetch'] = mockFetch;

      const result = await provider.postRules.repost(
        mockIntegration,
        mockAccessToken,
        'urn:li:share:123'
      );

      expect(result).toEqual({ status: 'auth_error' });
    });
  });

  describe('addPlugReply', () => {
    it('should successfully add a comment', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({}),
      });
      provider['fetch'] = mockFetch;

      const result = await provider.postRules.addPlugReply(
        mockIntegration,
        mockAccessToken,
        'urn:li:share:123',
        'Great post! Check out my content.'
      );

      expect(result).toEqual({
        status: 'added',
        remoteReleaseId: 'urn:li:share:123',
      });
    });

    it('should return auth_error for unauthorized comment', async () => {
      const mockFetch = jest.fn().mockRejectedValue({ status: 401 });
      provider['fetch'] = mockFetch;

      const result = await provider.postRules.addPlugReply(
        mockIntegration,
        mockAccessToken,
        'urn:li:share:123',
        'Test content'
      );

      expect(result).toEqual({ status: 'auth_error' });
    });
  });

  describe('legacy compatibility', () => {
    it('should maintain autoRepostPost method with same behavior', async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            likesSummary: { totalLikes: 100 },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({}),
        });
      provider['fetch'] = mockFetch;

      const result = await provider.autoRepostPost(
        mockIntegration,
        'urn:li:share:123',
        { likesAmount: '50' }
      );

      expect(result).toBe(true);
    });

    it('should maintain autoPlugPost method with same behavior', async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            likesSummary: { totalLikes: 100 },
          }),
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({}),
        });
      provider['fetch'] = mockFetch;

      const result = await provider.autoPlugPost(
        mockIntegration,
        'urn:li:share:123',
        { likesAmount: '50', post: 'Check this out!' }
      );

      expect(result).toBe(true);
    });
  });
});
