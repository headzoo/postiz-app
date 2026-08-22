/**
 * @jest-environment node
 */

import { XProvider } from './x.provider';

describe('XProvider.resolveAudienceProfileFromUrl', () => {
  const provider = new XProvider();

  it('returns null for URLs that are not X/Twitter profiles', async () => {
    await expect(
      provider.resolveAudienceProfileFromUrl(
        'token:secret',
        { id: 'integration' } as any,
        'https://bsky.app/profile/harbor.bsky.social'
      )
    ).resolves.toBeNull();
  });

  it('returns null for tweet status URLs', async () => {
    await expect(
      provider.resolveAudienceProfileFromUrl(
        'token:secret',
        { id: 'integration' } as any,
        'https://x.com/HarborClient/status/123'
      )
    ).resolves.toBeNull();
  });
});
