import { PostsRepository } from './posts.repository';

const repository = (post: Record<string, jest.Mock>) =>
  new PostsRepository(
    { model: { post } } as any,
    { model: {} } as any,
    { model: {} } as any,
    { model: {} } as any,
    { model: {} } as any,
    { model: {} } as any
  );

describe('Posts repository scheduling regressions', () => {
  it('keeps queued Pipeline drafts out of calendar results while showing scheduled and published posts', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const posts = repository({ findMany });

    await posts.getPosts('org', {
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-31T23:59:59.999Z',
    } as any);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          parentPostId: null,
          NOT: {
            state: 'DRAFT',
            pipelineQueueItemId: { not: null },
          },
        }),
      })
    );
  });

  it('merges customer filter into integration without dropping org constraints', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const posts = repository({ findMany });

    await posts.getPosts('org', {
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-31T23:59:59.999Z',
      customer: 'customer-1',
    } as any);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          integration: {
            deletedAt: null,
            organizationId: 'org',
            customerId: 'customer-1',
          },
        }),
      })
    );
  });

  it('keeps published posts analytics-visible rather than applying the upcoming filter', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const posts = repository({ findMany, count });

    await posts.getPostsList('org', { state: 'published', page: 0 } as any);

    const where = findMany.mock.calls[0][0].where;
    expect(where.state).toBe('PUBLISHED');
    expect(where.publishDate).toBeUndefined();
    expect(where.NOT).toEqual({
      state: 'DRAFT',
      pipelineQueueItemId: { not: null },
    });
    expect(count).toHaveBeenCalledWith({ where });
  });

  it.each([
    ['draft', true, 'DRAFT'],
    ['manual schedule', false, 'QUEUE'],
  ])('preserves %s state transitions when changing dates', async (_, isDraft, state) => {
    const update = jest.fn().mockResolvedValue({});
    const posts = repository({ update });

    await posts.changeDate(
      'org',
      'post',
      '2026-08-10T12:00:00.000Z',
      isDraft,
      'schedule'
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org', id: 'post' },
        data: expect.objectContaining({
          state,
          releaseId: null,
          releaseURL: null,
        }),
      })
    );
  });

  it('retains group/thread relationships when listing a post group', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const posts = repository({ findMany });

    await posts.getPostsByGroup('org', 'shared-group');

    expect(findMany).toHaveBeenCalledWith({
      where: {
        group: 'shared-group',
        organizationId: 'org',
        deletedAt: null,
      },
      include: expect.objectContaining({
        integration: true,
      }),
    });
  });

  it('keeps replacement roots and comments linked to a queued Pipeline item', async () => {
    const upsert = jest
      .fn()
      .mockResolvedValueOnce({ id: 'root' })
      .mockResolvedValueOnce({ id: 'comment' });
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const posts = new PostsRepository(
      { model: { post: { upsert, updateMany, findFirst: jest.fn() } } } as any,
      { model: {} } as any,
      { model: {} } as any,
      { model: {} } as any,
      { model: { tagsPosts: { deleteMany: jest.fn() } } } as any,
      { model: {} } as any
    );

    await posts.createOrUpdatePost(
      'draft',
      'org',
      '2026-08-10T12:00:00.000Z',
      {
        integration: { id: 'channel-a' },
        group: 'pipeline-group',
        settings: {},
        value: [
          { id: 'root', content: 'Root', image: [] },
          { id: 'comment', content: 'Comment', image: [] },
        ],
      } as any,
      [],
      'WEB' as any,
      undefined,
      true,
      'queue-item'
    );

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          pipelineQueueItem: { connect: { id: 'queue-item' } },
        }),
        update: expect.objectContaining({
          pipelineQueueItem: { connect: { id: 'queue-item' } },
        }),
      })
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        group: 'pipeline-group',
        deletedAt: null,
        pipelineQueueItemId: 'queue-item',
        integrationId: 'channel-a',
        id: { notIn: ['root', 'comment'] },
      },
      data: expect.objectContaining({ deletedAt: expect.any(Date) }),
    });
  });
});
