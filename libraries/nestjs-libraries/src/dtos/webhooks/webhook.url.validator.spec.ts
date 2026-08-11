import dns from 'node:dns/promises';
import { validate } from 'class-validator';
import { OpenGraphDto } from '@gitroom/nestjs-libraries/dtos/media/open.graph.dto';
import {
  isSafePublicHttpUrl,
  isSafePublicHttpsUrl,
} from './webhook.url.validator';

describe('public URL validators', () => {
  const lookup = jest.spyOn(dns, 'lookup') as jest.Mock;

  beforeEach(() => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  afterAll(() => {
    lookup.mockRestore();
  });

  it('keeps the webhook URL validator HTTPS-only', async () => {
    await expect(isSafePublicHttpsUrl('http://example.com/page')).resolves.toBe(
      false
    );
    await expect(
      isSafePublicHttpsUrl('https://example.com/page')
    ).resolves.toBe(true);
  });

  it('allows credential-free public HTTP and HTTPS URLs', async () => {
    await expect(isSafePublicHttpUrl('http://example.com/page')).resolves.toBe(
      true
    );
    await expect(isSafePublicHttpUrl('https://example.com/page')).resolves.toBe(
      true
    );
  });

  it.each([
    'ftp://example.com/page',
    'https://user:password@example.com/page',
    'http://localhost/page',
    'http://127.0.0.1/page',
    'http://169.254.169.254/latest/meta-data',
    'http://192.0.2.1/page',
    'http://[::1]/page',
    'http://[::ffff:7f00:1]/page',
  ])('rejects unsafe composer URL %s', async (url) => {
    await expect(isSafePublicHttpUrl(url)).resolves.toBe(false);
  });

  it('rejects a hostname when any DNS answer is private', async () => {
    lookup.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);

    await expect(isSafePublicHttpUrl('https://example.com/page')).resolves.toBe(
      false
    );
  });

  it('applies the HTTP(S) validator to OpenGraphDto', async () => {
    const dto = new OpenGraphDto();
    dto.url = 'https://user:password@example.com/page';
    await expect(validate(dto)).resolves.toHaveLength(1);
  });
});
