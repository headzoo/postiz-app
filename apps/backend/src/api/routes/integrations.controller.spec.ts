import { publicProfileUrl } from './integrations.controller';

describe('publicProfileUrl', () => {
  it('returns undefined for empty values', () => {
    expect(publicProfileUrl(undefined)).toBeUndefined();
    expect(publicProfileUrl('')).toBeUndefined();
  });

  it('accepts valid http and https URLs without credentials', () => {
    expect(publicProfileUrl('https://example.com/profile')).toBe(
      'https://example.com/profile'
    );
    expect(publicProfileUrl('http://example.com/profile')).toBe(
      'http://example.com/profile'
    );
  });

  it('rejects javascript: URLs', () => {
    expect(publicProfileUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('rejects malformed URLs', () => {
    expect(publicProfileUrl('not-a-url')).toBeUndefined();
    expect(publicProfileUrl('https://')).toBeUndefined();
  });

  it('rejects credential-bearing URLs', () => {
    expect(publicProfileUrl('https://user:pass@example.com/profile')).toBeUndefined();
    expect(publicProfileUrl('https://user@example.com/profile')).toBeUndefined();
    expect(publicProfileUrl('https://:pass@example.com/profile')).toBeUndefined();
  });
});
