/**
 * @jest-environment node
 */

import { BlueskyProvider } from './bluesky.provider';

describe('BlueskyProvider.resolveAudienceProfileFromUrl', () => {
  const provider = new BlueskyProvider();

  it('returns null for URLs that are not Bluesky profiles', async () => {
    await expect(
      provider.resolveAudienceProfileFromUrl(
        'token',
        { id: 'integration' } as any,
        'https://x.com/HarborClient'
      )
    ).resolves.toBeNull();
  });
});
