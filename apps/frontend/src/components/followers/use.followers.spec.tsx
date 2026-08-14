/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import { buildFollowersUrl } from './use.followers';

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
