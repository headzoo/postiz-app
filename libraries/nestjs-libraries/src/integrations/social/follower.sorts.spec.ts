import {
  compareFollowers,
  sortFollowers,
} from '@gitroom/nestjs-libraries/integrations/social/follower.sorts';

describe('follower.sorts', () => {
  const followers = [
    {
      id: 'b',
      name: 'Bravo',
      followersCount: 20,
      followingCount: 5,
      accountCreatedAt: '2024-02-01T00:00:00.000Z',
    },
    {
      id: 'a',
      name: 'Alpha',
      followersCount: 100,
      followingCount: 50,
      accountCreatedAt: '2023-01-01T00:00:00.000Z',
    },
  ];

  it('sorts followers by count descending', () => {
    expect(
      sortFollowers(followers, 'followers_count', 'desc').map((item) => item.id)
    ).toEqual(['a', 'b']);
  });

  it('sorts followers by name ascending', () => {
    expect(sortFollowers(followers, 'name', 'asc').map((item) => item.id)).toEqual(
      ['a', 'b']
    );
  });

  it('places missing values last when sorting ascending', () => {
    expect(
      compareFollowers(
        { id: 'missing', name: 'Missing' },
        { id: 'present', name: 'Present', followersCount: 1 },
        'followers_count',
        'asc'
      )
    ).toBeGreaterThan(0);
  });
});
