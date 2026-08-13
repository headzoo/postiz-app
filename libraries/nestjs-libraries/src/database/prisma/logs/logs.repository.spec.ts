import { LogsRepository } from './logs.repository';

const repository = (
  postHttpLog: Record<string, jest.Mock>,
  webhookHttpLog: Record<string, jest.Mock>
) =>
  new LogsRepository(
    { model: { postHttpLog } } as any,
    { model: { webhookHttpLog } } as any
  );

describe('LogsRepository', () => {
  it('creates and lists post logs scoped to the organization', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'log-1' });
    const findMany = jest.fn().mockResolvedValue([{ id: 'log-1' }]);
    const count = jest.fn().mockResolvedValue(1);
    const logs = repository({ create, findMany, count }, {});

    await logs.createPostLog({
      organizationId: 'org-1',
      provider: 'x',
      method: 'POST',
      url: 'https://api.x.com/2/tweets',
      requestHeaders: '{}',
      requestBody: '{}',
      responseHeaders: '{}',
      responseBody: '{}',
    });
    const listed = await logs.listPostLogs('org-1', 0, 20);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'org-1', provider: 'x' }),
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        skip: 0,
        take: 20,
      })
    );
    expect(listed).toEqual(
      expect.objectContaining({ total: 1, page: 0, limit: 20, hasMore: false })
    );
  });

  it('filters webhook logs by organization and optional direction', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const logs = repository({}, { findMany, count });

    await logs.listWebhookLogs('org-2', 1, 10, 'OUTBOUND' as any);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-2', direction: 'OUTBOUND' },
        skip: 10,
        take: 10,
      })
    );
    expect(count).toHaveBeenCalledWith({
      where: { organizationId: 'org-2', direction: 'OUTBOUND' },
    });
  });
});
