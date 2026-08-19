import { InfiniteWorkflowRegister } from './infinite.workflow.register';

describe('InfiniteWorkflowRegister', () => {
  const previousRunCron = process.env.RUN_CRON;

  const createRegister = (
    workflow: {
      getHandle: jest.Mock;
      start: jest.Mock;
    },
    scheduleService = { install: jest.fn().mockResolvedValue(undefined) }
  ) =>
    new InfiniteWorkflowRegister(
      {
        client: { getRawClient: () => ({ workflow }) },
      } as any,
      scheduleService as any
    );

  const steadyStateWorkflow = () => ({
    getHandle: jest.fn().mockReturnValue({
      describe: jest.fn().mockRejectedValue(
        Object.assign(new Error('workflow not found'), {
          name: 'WorkflowNotFoundError',
        })
      ),
      signal: jest.fn().mockResolvedValue(undefined),
    }),
    start: jest.fn().mockResolvedValue(undefined),
  });

  afterEach(() => {
    if (previousRunCron === undefined) {
      delete process.env.RUN_CRON;
    } else {
      process.env.RUN_CRON = previousRunCron;
    }
  });

  it('installs the relationship grade Temporal schedule when cron execution is enabled', async () => {
    const workflow = steadyStateWorkflow();
    const scheduleService = { install: jest.fn().mockResolvedValue(undefined) };
    const register = createRegister(workflow, scheduleService);
    process.env.RUN_CRON = '1';

    await register.onModuleInit();

    expect(scheduleService.install).toHaveBeenCalled();
    expect(workflow.start).not.toHaveBeenCalledWith(
      'channelRelationshipGradeWorkflowV1',
      expect.anything()
    );
    expect(workflow.start).toHaveBeenCalledWith(
      'channelInteractionMaintenanceWorkflowV2',
      expect.objectContaining({
        workflowId: 'channel-interaction-maintenance-workflow-v2',
        taskQueue: 'main',
        args: [{}],
      })
    );
    expect(workflow.start).toHaveBeenCalledWith(
      'channelAnalyticsSnapshotWorkflowV2',
      expect.objectContaining({
        workflowId: 'channel-analytics-snapshot-workflow-v2',
        taskQueue: 'main',
        args: [{}],
      })
    );
    expect(workflow.getHandle).toHaveBeenCalledWith(
      'channel-analytics-snapshot-workflow-v2'
    );
    expect(workflow.getHandle().signal).toHaveBeenCalledWith(
      'channelAnalyticsSnapshot'
    );
  });

  it('treats an already-started analytics workflow as steady state', async () => {
    const workflow = steadyStateWorkflow();
    workflow.start
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        Object.assign(new Error('workflow already started'), {
          name: 'WorkflowExecutionAlreadyStartedError',
        })
      );
    const register = createRegister(workflow);
    process.env.RUN_CRON = '1';

    await expect(register.onModuleInit()).resolves.toBeUndefined();
    expect(workflow.start).toHaveBeenLastCalledWith(
      'channelAnalyticsSnapshotWorkflowV2',
      expect.objectContaining({
        workflowId: 'channel-analytics-snapshot-workflow-v2',
      })
    );
  });

  it('does not start maintenance workflows when cron execution is disabled', async () => {
    const workflow = steadyStateWorkflow();
    const register = createRegister(workflow);
    delete process.env.RUN_CRON;

    await register.onModuleInit();

    expect(workflow.start).not.toHaveBeenCalled();
  });
});
