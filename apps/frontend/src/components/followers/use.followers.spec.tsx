/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import {
  applyRelationshipSnapshotToFollowerPage,
  buildFollowersUrl,
  isFollowerListCacheKey,
} from './use.followers';

describe('buildFollowersUrl', () => {
  const baseParams = {
    integrationId: 'channel-1',
    limit: 24,
  };

  it('serializes triage filters into the follower endpoint URL', () => {
    expect(
      buildFollowersUrl({
        ...baseParams,
        triage: 'engaged_not_yet',
      })
    ).toBe('/followers/channel-1?limit=24&triage=engaged_not_yet');

    expect(
      buildFollowersUrl({
        ...baseParams,
        triage: 'hot_lead',
      })
    ).toBe('/followers/channel-1?limit=24&triage=hot_lead');

    expect(
      buildFollowersUrl({
        ...baseParams,
        triage: 'mutual',
      })
    ).toBe('/followers/channel-1?limit=24&triage=mutual');

    expect(
      buildFollowersUrl({
        ...baseParams,
        triage: 'over_invested',
      })
    ).toBe('/followers/channel-1?limit=24&triage=over_invested');

    expect(
      buildFollowersUrl({
        ...baseParams,
        triage: 'quiet',
      })
    ).toBe('/followers/channel-1?limit=24&triage=quiet');
  });

  it('omits triage when the filter is cleared', () => {
    expect(buildFollowersUrl(baseParams)).toBe('/followers/channel-1?limit=24');
  });

  it('preserves search, sort, direction, and window alongside triage', () => {
    expect(
      buildFollowersUrl({
        ...baseParams,
        sort: 'their_effort',
        direction: 'desc',
        window: 'month',
        search: 'alex',
        triage: 'hot_lead',
        cursor: 'cursor-2',
      })
    ).toBe(
      '/followers/channel-1?limit=24&cursor=cursor-2&sort=their_effort&direction=desc&window=month&search=alex&triage=hot_lead'
    );
  });
});

describe('follower list cache updates', () => {
  it('matches list keys for the same channel and ignores member detail keys', () => {
    expect(
      isFollowerListCacheKey('channel-1', '/followers/channel-1?limit=24')
    ).toBe(true);
    expect(
      isFollowerListCacheKey(
        'channel-1',
        '/followers/channel-1/member?externalId=follower-1'
      )
    ).toBe(false);
    expect(
      isFollowerListCacheKey('channel-1', '/followers/channel-2?limit=24')
    ).toBe(false);
  });

  it('patches the matching follower card fields from a refreshed snapshot', () => {
    const page = {
      items: [
        {
          id: 'follower-1',
          name: 'Alex',
          effortStars: 2,
          reciprocationStars: 1.5,
        },
        { id: 'follower-2', name: 'Sam', effortStars: 1 },
      ],
      hasMore: false,
    };

    expect(
      applyRelationshipSnapshotToFollowerPage(page, 'follower-1', {
        snapshotAt: '2026-08-14T12:00:00.000Z',
        windowStartedAt: '2026-07-15T12:00:00.000Z',
        effortScore: 10,
        reciprocationScore: 30,
        reciprocity: 1 / 3,
        grade: 5,
        adjustedGrade: 5,
        effortStars: 2,
        reciprocationStars: 4,
        triage: 'hot_lead',
        formulaVersion: 2,
      })
    ).toEqual({
      items: [
        {
          id: 'follower-1',
          name: 'Alex',
          effortScore: 10,
          reciprocationScore: 30,
          netGap: 20,
          effortStars: 2,
          reciprocationStars: 4,
          relationshipGrade: 5,
          relationshipTriage: 'hot_lead',
          relationshipFormulaVersion: 2,
          relationshipSnapshotAt: '2026-08-14T12:00:00.000Z',
          adjustedGrade: 5,
        },
        { id: 'follower-2', name: 'Sam', effortStars: 1 },
      ],
      hasMore: false,
    });
  });
});
