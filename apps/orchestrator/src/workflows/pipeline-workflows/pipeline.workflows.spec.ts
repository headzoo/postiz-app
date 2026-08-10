const claimPipelineSlot = jest.fn();
const finalizePipelineSlot = jest.fn();
const discoverDuePipelineSlots = jest.fn();
const startChild = jest.fn();
const sleep = jest.fn();
const continueAsNew = jest.fn();

jest.mock('@temporalio/workflow', () => ({
  proxyActivities: () => ({
    claimPipelineSlot,
    finalizePipelineSlot,
    discoverDuePipelineSlots,
  }),
  startChild,
  sleep,
  continueAsNew,
}));

jest.mock(
  '@gitroom/orchestrator/workflows/post-workflows/post.workflow.v1.0.6',
  () => ({ postWorkflowV106: 'postWorkflowV106' })
);

import { pipelineSlotWorkflowV1 } from './pipeline.slot.workflow.v1';
import { pipelineSchedulerWorkflowV1 } from './pipeline.scheduler.workflow.v1';

describe('Pipeline Temporal workflow boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches one existing post workflow per channel root and finalizes persisted state', async () => {
    claimPipelineSlot.mockResolvedValue({
      outcome: 'CLAIMED',
      executionId: 'execution',
      roots: [
        { postId: 'twitter-root', organizationId: 'org', taskQueue: 'x' },
        { postId: 'linkedin-root', organizationId: 'org', taskQueue: 'linkedin' },
      ],
    });
    startChild.mockImplementation(async () => ({ result: async () => undefined }));
    finalizePipelineSlot.mockResolvedValue({ outcome: 'PUBLISHED' });

    await expect(
      pipelineSlotWorkflowV1({
        pipelineId: 'pipeline',
        scheduleRevision: 2,
        scheduledFor: '2026-08-10T10:00:00.000Z',
      })
    ).resolves.toEqual({ outcome: 'PUBLISHED' });

    expect(startChild).toHaveBeenCalledTimes(2);
    expect(startChild).toHaveBeenNthCalledWith(
      1,
      'postWorkflowV106',
      expect.objectContaining({
        workflowId: 'post_twitter-root',
        taskQueue: 'main',
        args: [{ taskQueue: 'x', postId: 'twitter-root', organizationId: 'org' }],
        typedSearchAttributes: expect.anything(),
      })
    );
    expect(startChild).toHaveBeenNthCalledWith(
      2,
      'postWorkflowV106',
      expect.objectContaining({
        workflowId: 'post_linkedin-root',
        args: [
          {
            taskQueue: 'linkedin',
            postId: 'linkedin-root',
            organizationId: 'org',
          },
        ],
      })
    );
    expect(finalizePipelineSlot).toHaveBeenCalledWith({ executionId: 'execution' });
  });

  it('finalizes a claimed slot after a child failure without replaying provider work', async () => {
    claimPipelineSlot.mockResolvedValue({
      outcome: 'CLAIMED',
      executionId: 'execution',
      roots: [{ postId: 'root', organizationId: 'org', taskQueue: 'x' }],
    });
    startChild.mockRejectedValue(new Error('provider failed'));
    finalizePipelineSlot.mockResolvedValue({
      outcome: 'FAILED',
      reason: 'Provider rejected the post',
    });

    await expect(
      pipelineSlotWorkflowV1({
        pipelineId: 'pipeline',
        scheduleRevision: 2,
        scheduledFor: '2026-08-10T10:00:00.000Z',
      })
    ).resolves.toMatchObject({ outcome: 'FAILED' });
    expect(finalizePipelineSlot).toHaveBeenCalledWith({ executionId: 'execution' });
  });

  it('uses occurrence IDs for scheduler children and tolerates duplicate ticks', async () => {
    discoverDuePipelineSlots.mockResolvedValue({
      candidates: [
        {
          occurrenceId: 'pipeline:pipeline:2:2026-08-10T10:00:00.000Z',
          pipelineId: 'pipeline',
          scheduleRevision: 2,
          scheduledFor: '2026-08-10T10:00:00.000Z',
        },
      ],
    });
    startChild.mockRejectedValue(
      Object.assign(new Error('workflow already started'), {
        name: 'WorkflowExecutionAlreadyStartedError',
      })
    );
    sleep.mockRejectedValue(new Error('stop after first tick'));

    await expect(pipelineSchedulerWorkflowV1()).rejects.toThrow('stop after first tick');
    expect(startChild).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        workflowId: 'pipeline:pipeline:2:2026-08-10T10:00:00.000Z',
        args: [
          {
            pipelineId: 'pipeline',
            scheduleRevision: 2,
            scheduledFor: '2026-08-10T10:00:00.000Z',
          },
        ],
      })
    );
  });

  it('pages through every due candidate before sleeping', async () => {
    discoverDuePipelineSlots
      .mockResolvedValueOnce({
        candidates: [
          {
            occurrenceId: 'pipeline:first',
            pipelineId: 'first',
            scheduleRevision: 1,
            scheduledFor: '2026-08-10T10:00:00.000Z',
          },
        ],
        next: {
          pipelineId: 'first',
          scheduledFor: '2026-08-10T10:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        candidates: [
          {
            occurrenceId: 'pipeline:second',
            pipelineId: 'second',
            scheduleRevision: 1,
            scheduledFor: '2026-08-10T10:00:00.000Z',
          },
        ],
      });
    startChild.mockResolvedValue({});
    sleep.mockRejectedValue(new Error('stop after first tick'));

    await expect(pipelineSchedulerWorkflowV1()).rejects.toThrow(
      'stop after first tick'
    );

    expect(startChild).toHaveBeenCalledTimes(2);
    expect(discoverDuePipelineSlots).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        after: {
          pipelineId: 'first',
          scheduledFor: '2026-08-10T10:00:00.000Z',
        },
      })
    );
  });

  it('sleeps and retries after discovery exhausts its activity retries', async () => {
    discoverDuePipelineSlots.mockRejectedValue(new Error('discovery exhausted'));
    sleep.mockRejectedValue(new Error('stop after failed discovery'));

    await expect(pipelineSchedulerWorkflowV1()).rejects.toThrow(
      'stop after failed discovery'
    );

    expect(startChild).not.toHaveBeenCalled();
    expect(sleep).toHaveBeenCalledWith(30 * 1000);
  });
});
