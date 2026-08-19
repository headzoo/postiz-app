import { customFetch } from './custom.fetch.func';

describe('customFetch admin_auth handling', () => {
  const originalFetch = global.fetch;
  const originalDocument = global.document;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.document = originalDocument;
  });

  it('sends the admin-auth header from the mirrored cookie in NOT_SECURED mode', async () => {
    global.document = {
      cookie: 'auth=session-token; admin_auth=step-up-token',
    } as Document;

    const fetchFn = customFetch({ baseUrl: 'http://api.test' }, undefined, undefined, false);
    await fetchFn('/admin-auth/status');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://api.test/admin-auth/status',
      expect.objectContaining({
        headers: expect.objectContaining({
          auth: 'session-token',
          'admin-auth': 'step-up-token',
        }),
      })
    );
  });

  it('does not treat admin_auth as the auth cookie', async () => {
    global.document = {
      cookie: 'admin_auth=step-up-token',
    } as Document;

    const fetchFn = customFetch({ baseUrl: 'http://api.test' }, undefined, undefined, false);
    await fetchFn('/admin-auth/status');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://api.test/admin-auth/status',
      expect.objectContaining({
        headers: expect.not.objectContaining({
          auth: 'step-up-token',
        }),
      })
    );
  });
});
