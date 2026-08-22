jest.mock('nestjs-temporal-core', () => ({
  Activity: () => () => undefined,
  ActivityMethod: () => () => undefined,
}));

import { PipelineActivity } from './pipeline.activity';

describe('PipelineActivity.discoverDuePipelineSlots', () => {
  it('skips logging for empty ticks and logs when candidates exist', async () => {
    const discoverDueSlots = jest
      .fn()
      .mockResolvedValueOnce({ candidates: [], next: undefined })
      .mockResolvedValueOnce({
        candidates: [{ pipelineId: 'p1' }],
        next: undefined,
      });
    const append = jest.fn().mockResolvedValue(undefined);
    const activity = new PipelineActivity(
      { discoverDueSlots } as any,
      { append } as any
    );

    await activity.discoverDuePipelineSlots({
      nowUtc: '2026-08-22T00:00:00.000Z',
      maximumCandidates: 100,
    });
    expect(append).not.toHaveBeenCalled();

    await activity.discoverDuePipelineSlots({
      nowUtc: '2026-08-22T00:00:30.000Z',
      maximumCandidates: 100,
    });
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleKey: 'post-workflows',
        message: expect.stringContaining('1 due pipeline slot'),
      })
    );
  });

  it('logs errors when discovery fails', async () => {
    const discoverDueSlots = jest
      .fn()
      .mockRejectedValue(new Error('discovery failed'));
    const append = jest.fn().mockResolvedValue(undefined);
    const activity = new PipelineActivity(
      { discoverDueSlots } as any,
      { append } as any
    );

    await expect(
      activity.discoverDuePipelineSlots({
        nowUtc: '2026-08-22T00:00:00.000Z',
        maximumCandidates: 100,
      })
    ).rejects.toThrow('discovery failed');
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleKey: 'post-workflows',
        level: 'ERROR',
      })
    );
  });
});
