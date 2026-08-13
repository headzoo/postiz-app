import {
  MAX_HTTP_LOG_BODY,
  readCappedHttpLogBody,
  redactHttpLogUrl,
  serializeHttpLogBody,
  serializeHttpLogHeaders,
  truncateHttpLogBody,
} from './http-log.serialize';

describe('HTTP log serialization', () => {
  it('redacts sensitive headers and keeps others', () => {
    expect(
      JSON.parse(
        serializeHttpLogHeaders({
          Authorization: 'Bearer secret',
          Cookie: 'session=1',
          'Content-Type': 'application/json',
        })
      )
    ).toEqual({
      Authorization: '[redacted]',
      Cookie: '[redacted]',
      'Content-Type': 'application/json',
    });
  });

  it('redacts access tokens in query strings', () => {
    expect(
      redactHttpLogUrl(
        'https://api.example.com/post?access_token=secret&keep=1'
      )
    ).toBe(
      'https://api.example.com/post?access_token=%5Bredacted%5D&keep=1'
    );
  });

  it('omits binary and streamed bodies', () => {
    expect(serializeHttpLogBody(Buffer.from('file'), 'image/png')).toBe(
      '[binary omitted]'
    );
    expect(serializeHttpLogBody({ pipe() {} })).toBe('[binary omitted]');
  });

  it('truncates large text bodies', () => {
    const body = 'x'.repeat(MAX_HTTP_LOG_BODY + 20);
    const serialized = truncateHttpLogBody(body);
    expect(serialized.startsWith('x'.repeat(MAX_HTTP_LOG_BODY))).toBe(true);
    expect(serialized).toContain('[truncated 20 chars]');
  });

  it('stops reading a streamed response after the cap', async () => {
    const payload = 'x'.repeat(MAX_HTTP_LOG_BODY + 50);
    const encoded = new TextEncoder().encode(payload);
    let cancelled = false;
    const response = {
      headers: { get: () => 'application/json' },
      body: {
        getReader() {
          let read = false;
          return {
            async read() {
              if (read) {
                return { done: true, value: undefined };
              }
              read = true;
              return { done: false, value: encoded };
            },
            async cancel() {
              cancelled = true;
            },
          };
        },
      },
    };

    const body = await readCappedHttpLogBody(response as any);
    expect(cancelled).toBe(true);
    expect(body).toContain('[truncated');
    expect(body.length).toBeLessThan(payload.length);
  });
});
