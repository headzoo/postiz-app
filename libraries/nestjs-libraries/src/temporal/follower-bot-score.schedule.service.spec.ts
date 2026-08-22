import { FollowerBotScoreScheduleService } from './follower-bot-score.schedule.service';
import { DEFAULT_FOLLOWER_BOT_SCORE_SCHEDULE } from './follower-bot-score.schedule';

describe('FollowerBotScoreScheduleService', () => {
  const createService = (schedule: {
    create: jest.Mock;
    getHandle: jest.Mock;
  }) =>
    new FollowerBotScoreScheduleService(
      {
        client: { getRawClient: () => ({ schedule }) },
      } as any,
      { append: jest.fn().mockResolvedValue(undefined) } as any
    );

  it('creates a default schedule when none exists', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const describe = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('not found'), { name: 'ScheduleNotFoundError' })
      )
      .mockResolvedValue({
        state: { paused: false },
        memo: { cadence: DEFAULT_FOLLOWER_BOT_SCORE_SCHEDULE },
        info: { nextActionTimes: [new Date('2026-08-22T00:00:00.000Z')] },
      });
    const schedule = {
      create,
      getHandle: jest.fn().mockReturnValue({
        describe,
        update: jest.fn(),
        trigger: jest.fn(),
      }),
    };
    const service = createService(schedule);

    await service.install();
    const status = await service.getStatus();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: 'channel-follower-bot-score-schedule-v1',
        action: expect.objectContaining({
          type: 'startWorkflow',
          workflowType: 'channelFollowerBotScoreWorkflowV1',
        }),
      })
    );
    expect(status.exists).toBe(true);
    expect(status.cadence).toEqual(DEFAULT_FOLLOWER_BOT_SCORE_SCHEDULE);
    expect(status.nextRunTimes).toEqual(['2026-08-22T00:00:00.000Z']);
  });

  it('updates an existing schedule cadence', async () => {
    const cadence = { intervalHours: 3 };
    const describe = jest.fn().mockResolvedValue({
      state: { paused: false },
      policies: { catchupWindow: 60000, pauseOnFailure: false },
      memo: { cadence },
      info: { nextActionTimes: [] },
    });
    const update = jest.fn().mockImplementation(async (updater) => {
      updater({
        state: { paused: false },
        policies: { catchupWindow: 60000, pauseOnFailure: false },
      });
    });
    const schedule = {
      create: jest.fn(),
      getHandle: jest.fn().mockReturnValue({
        describe,
        update,
        trigger: jest.fn(),
      }),
    };
    const service = createService(schedule);

    await service.update(cadence);
    expect(update).toHaveBeenCalled();
    expect(schedule.create).not.toHaveBeenCalled();
  });

  it('triggers an existing schedule', async () => {
    const describe = jest.fn().mockResolvedValue({
      state: { paused: false },
      memo: { cadence: DEFAULT_FOLLOWER_BOT_SCORE_SCHEDULE },
      info: { nextActionTimes: [] },
    });
    const trigger = jest.fn().mockResolvedValue(undefined);
    const schedule = {
      create: jest.fn(),
      getHandle: jest.fn().mockReturnValue({
        describe,
        update: jest.fn(),
        trigger,
      }),
    };
    const service = createService(schedule);

    await service.trigger();
    expect(trigger).toHaveBeenCalled();
  });
});
