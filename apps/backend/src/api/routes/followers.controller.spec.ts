import { FollowersController } from './followers.controller';

describe('FollowersController', () => {
  const org = { id: 'org-a' } as any;
  const service = {
    getFollowerChannels: jest.fn(),
    getFollowers: jest.fn(),
  };
  const controller = new FollowersController(service as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates eligible channel discovery using the request organization', async () => {
    service.getFollowerChannels.mockResolvedValue([{ id: 'channel-a' }]);

    await expect(controller.getChannels(org)).resolves.toEqual([
      { id: 'channel-a' },
    ]);
    expect(service.getFollowerChannels).toHaveBeenCalledWith(org);
  });

  it('forwards a validated follower page query and scoped organization', async () => {
    const query = {
      limit: 24,
      cursor: 'opaque-cursor',
      sort: 'recent',
      direction: 'desc' as const,
    };
    service.getFollowers.mockResolvedValue({ items: [], hasMore: false });

    await expect(
      controller.getFollowers(org, 'channel-a', query)
    ).resolves.toEqual({ items: [], hasMore: false });
    expect(service.getFollowers).toHaveBeenCalledWith(org, 'channel-a', query);
  });
});
