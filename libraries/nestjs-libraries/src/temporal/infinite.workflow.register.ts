import {
  Global,
  Injectable,
  Logger,
  Module,
  OnModuleInit,
} from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class InfiniteWorkflowRegister implements OnModuleInit {
  private readonly _logger = new Logger(InfiniteWorkflowRegister.name);

  constructor(private _temporalService: TemporalService) { }

  async onModuleInit(): Promise<void> {
    if (!!process.env.RUN_CRON) {
      try {
        await this._temporalService.client
          ?.getRawClient()
          ?.workflow?.start('missingPostWorkflow', {
            workflowId: 'missing-post-workflow',
            taskQueue: 'main',
          });
      } catch (err) { }
      await this.handoffPipelineScheduler();
      await this.startChannelInteractionMaintenance();
      await this.startChannelRelationshipGrade();
      await this.startChannelAnalyticsSnapshot();
    }
  }

  private async handoffPipelineScheduler() {
    const workflow = this._temporalService.client?.getRawClient()?.workflow;
    if (!workflow) {
      throw new Error('Temporal workflow client unavailable during scheduler handoff');
    }

    try {
      const v1 = workflow.getHandle('pipeline-scheduler-workflow-v1');
      const description = await v1.describe();
      if (description.status.name === 'RUNNING') {
        await v1.terminate('Migrating Pipeline scheduler to V2');
      }
    } catch (error) {
      if (!this.isMissingOrClosed(error)) {
        this._logger.error('Failed to stop Pipeline scheduler V1', error);
        throw error;
      }
    }

    try {
      await workflow.start('pipelineSchedulerWorkflowV2', {
        workflowId: 'pipeline-scheduler-workflow-v2',
        taskQueue: 'main',
        args: [{}],
      });
    } catch (error) {
      if (!this.isAlreadyStarted(error)) {
        this._logger.error('Failed to start Pipeline scheduler V2', error);
        throw error;
      }
    }
  }

  private async startChannelInteractionMaintenance() {
    const workflow = this._temporalService.client?.getRawClient()?.workflow;
    if (!workflow) {
      throw new Error('Temporal workflow client unavailable during maintenance start');
    }
    try {
      const v1 = workflow.getHandle('channel-interaction-maintenance-workflow-v1');
      const description = await v1.describe();
      if (description.status.name === 'RUNNING') {
        await v1.terminate('Migrating Channel interaction maintenance to V2');
      }
    } catch (error) {
      if (!this.isMissingOrClosed(error)) {
        this._logger.error('Failed to stop Channel interaction maintenance V1', error);
        throw error;
      }
    }

    try {
      await workflow.start('channelInteractionMaintenanceWorkflowV2', {
        workflowId: 'channel-interaction-maintenance-workflow-v2',
        taskQueue: 'main',
        args: [{}],
      });
    } catch (error) {
      if (!this.isAlreadyStarted(error)) {
        this._logger.error('Failed to start Channel interaction maintenance', error);
        throw error;
      }
    }
    try {
      await workflow
        .getHandle('channel-interaction-maintenance-workflow-v2')
        .signal('channelInteractionMaintenance');
    } catch (error) {
      this._logger.warn(
        'Channel interaction maintenance was not poked after start',
        error
      );
    }
  }

  private async startChannelRelationshipGrade() {
    const workflow = this._temporalService.client?.getRawClient()?.workflow;
    if (!workflow) {
      throw new Error(
        'Temporal workflow client unavailable during relationship grade start'
      );
    }
    try {
      await workflow.start('channelRelationshipGradeWorkflowV1', {
        workflowId: 'channel-relationship-grade-workflow-v1',
        taskQueue: 'main',
        args: [{}],
      });
    } catch (error) {
      if (!this.isAlreadyStarted(error)) {
        this._logger.error('Failed to start Channel relationship grade', error);
        throw error;
      }
    }
  }

  private async startChannelAnalyticsSnapshot() {
    const workflow = this._temporalService.client?.getRawClient()?.workflow;
    if (!workflow) {
      throw new Error(
        'Temporal workflow client unavailable during analytics snapshot start'
      );
    }
    try {
      await workflow.start('channelAnalyticsSnapshotWorkflowV1', {
        workflowId: 'channel-analytics-snapshot-workflow-v1',
        taskQueue: 'main',
        args: [{}],
      });
    } catch (error) {
      if (!this.isAlreadyStarted(error)) {
        this._logger.error('Failed to start Channel analytics snapshot', error);
        throw error;
      }
    }
  }

  private isMissingOrClosed(error: unknown) {
    const value = error as { name?: string; message?: string };
    const message = value?.message?.toLowerCase() || '';
    return (
      value?.name === 'WorkflowNotFoundError' ||
      value?.name === 'WorkflowExecutionAlreadyCompletedError' ||
      message.includes('not found') ||
      message.includes('already completed') ||
      message.includes('already closed')
    );
  }

  private isAlreadyStarted(error: unknown) {
    const value = error as { name?: string; message?: string };
    return (
      value?.name === 'WorkflowExecutionAlreadyStartedError' ||
      !!value?.message?.toLowerCase().includes('already started')
    );
  }
}

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [InfiniteWorkflowRegister],
  get exports() {
    return this.providers;
  },
})
export class InfiniteWorkflowRegisterModule { }
