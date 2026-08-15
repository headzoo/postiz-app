import { InfiniteWorkflowRegister } from './infinite.workflow.register';

describe('InfiniteWorkflowRegister', () => {
  const previousRunCron = process.env.RUN_CRON;

  const createRegister = (workflow: {
    getHandle: jest.Mock;
    start: jest.Mock;
  }) =>
    new InfiniteWorkflowRegister({
      client: { getRawClient: () => ({ workflow }) },
    } as any);

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

  it('starts channel relationship grade workflow when cron execution is enabled', async () => {
    const workflow = steadyStateWorkflow();
    const register = createRegister(workflow);
    process.env.RUN_CRON = '1';

    await register.onModuleInit();

    expect(workflow.getHandle).toHaveBeenCalledWith(
      'channel-interaction-maintenance-workflow-v2'
    );
    expect(workflow.getHandle().signal).toHaveBeenCalledWith(
      'channelInteractionMaintenance'
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
      'channelRelationshipGradeWorkflowV1',
      expect.objectContaining({
        workflowId: 'channel-relationship-grade-workflow-v1',
        taskQueue: 'main',
        args: [{}],
      })
    );
    expect(workflow.start).toHaveBeenCalledWith(
      'channelAnalyticsSnapshotWorkflowV1',
      expect.objectContaining({
        workflowId: 'channel-analytics-snapshot-workflow-v1',
        taskQueue: 'main',
        args: [{}],
      })
    );
  });

  it('treats an already-started relationship grade workflow as steady state', async () => {
    const workflow = steadyStateWorkflow();
    workflow.start
      .mockResolvedValueOnce(undefined)
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
      'channelAnalyticsSnapshotWorkflowV1',
      expect.objectContaining({
        workflowId: 'channel-analytics-snapshot-workflow-v1',
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
