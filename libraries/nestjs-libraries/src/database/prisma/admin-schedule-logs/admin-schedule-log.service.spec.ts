import { AdminScheduleLogKey, AdminScheduleLogLevel } from '@prisma/client';
import { AdminScheduleLogService } from './admin-schedule-log.service';

describe('AdminScheduleLogService', () => {
  const createService = (repository: {
    create: jest.Mock;
    listByKey: jest.Mock;
    pruneByKey: jest.Mock;
  }) => new AdminScheduleLogService(repository as any);

  it('appends using slug keys and never throws on writer failure', async () => {
    const create = jest.fn().mockRejectedValue(new Error('db down'));
    const pruneByKey = jest.fn().mockResolvedValue(0);
    const service = createService({
      create,
      listByKey: jest.fn(),
      pruneByKey,
    });

    await expect(
      service.append({
        scheduleKey: 'lead-bridge',
        message: 'scan complete',
        meta: { scanned: 3 },
      })
    ).resolves.toBeUndefined();
  });

  it('persists capped message and triggers prune', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'log-1' });
    const pruneByKey = jest.fn().mockResolvedValue(0);
    const service = createService({
      create,
      listByKey: jest.fn(),
      pruneByKey,
    });

    await service.append({
      scheduleKey: AdminScheduleLogKey.RELATIONSHIP_GRADES,
      level: 'WARN',
      message: 'x'.repeat(3000),
      meta: { ok: true },
    });

    expect(create).toHaveBeenCalledWith({
      scheduleKey: AdminScheduleLogKey.RELATIONSHIP_GRADES,
      level: AdminScheduleLogLevel.WARN,
      message: expect.stringMatching(/^x{2000}$/),
      meta: JSON.stringify({ ok: true }),
    });
    expect(pruneByKey).toHaveBeenCalledWith(
      AdminScheduleLogKey.RELATIONSHIP_GRADES
    );
  });

  it('lists by slug', async () => {
    const listByKey = jest.fn().mockResolvedValue({ items: [], limit: 100 });
    const service = createService({
      create: jest.fn(),
      listByKey,
      pruneByKey: jest.fn(),
    });

    await service.list('post-workflows', 25);
    expect(listByKey).toHaveBeenCalledWith(
      AdminScheduleLogKey.POST_WORKFLOWS,
      25
    );
  });
});
