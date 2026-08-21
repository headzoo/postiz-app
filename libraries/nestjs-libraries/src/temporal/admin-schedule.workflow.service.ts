import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';
import { AutopostRepository } from '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.repository';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import {
  AUTOPOST_ADMIN_TRIGGER_WORKFLOW_ID_PREFIX,
  AUTOPOST_ADMIN_TRIGGER_WORKFLOW_TYPE,
  MISSING_POST_RECOVERY_WORKFLOW_ID_PREFIX,
  MISSING_POST_RECOVERY_WORKFLOW_TYPE,
  MISSING_POST_WORKFLOW_ID,
  PIPELINE_SCHEDULER_TICK_WORKFLOW_ID_PREFIX,
  PIPELINE_SCHEDULER_TICK_WORKFLOW_TYPE,
  PIPELINE_SCHEDULER_WORKFLOW_ID,
} from './admin-schedule.workflow';
import {
  LEAD_BRIDGE_DAILY_LIMIT,
  LEAD_BRIDGE_IDLE_MS,
  LEAD_BRIDGE_WORKFLOW_ID,
  LEAD_BRIDGE_WORKFLOW_TYPE,
} from './lead-bridge.schedule';

export type AdminWorkflowCadence = {
  unit: 'second' | 'hour';
  interval: number;
  label: string;
};

export type AdminWorkflowStatus = {
  workflowId: string;
  exists: boolean;
  status: string;
  cadence: AdminWorkflowCadence;
  startedAt?: string;
  note?: string;
};

export type AutopostWorkflowStatus = AdminWorkflowStatus & {
  activeCount: number;
};

@Injectable()
export class AdminScheduleWorkflowService {
  constructor(
    private _temporalService: TemporalService,
    private _autopostRepository: AutopostRepository
  ) { }

  async getMissingPostRecoveryStatus(): Promise<AdminWorkflowStatus> {
    return this.describeWorkflow(MISSING_POST_WORKFLOW_ID, {
      unit: 'hour',
      interval: 1,
      label: 'Every hour (fixed in workflow)',
    });
  }

  async triggerMissingPostRecovery() {
    await this.startOneShot(
      MISSING_POST_RECOVERY_WORKFLOW_TYPE,
      `${MISSING_POST_RECOVERY_WORKFLOW_ID_PREFIX}-${makeId(8)}`,
      [{}]
    );
    return this.getMissingPostRecoveryStatus();
  }

  async getPostWorkflowStatus(): Promise<AdminWorkflowStatus> {
    return this.describeWorkflow(PIPELINE_SCHEDULER_WORKFLOW_ID, {
      unit: 'second',
      interval: 30,
      label: 'Every 30 seconds (fixed in workflow)',
    });
  }

  async triggerPostWorkflowTick() {
    await this.startOneShot(
      PIPELINE_SCHEDULER_TICK_WORKFLOW_TYPE,
      `${PIPELINE_SCHEDULER_TICK_WORKFLOW_ID_PREFIX}-${makeId(8)}`,
      [{}]
    );
    return this.getPostWorkflowStatus();
  }

  async getAutopostWorkflowStatus(): Promise<AutopostWorkflowStatus> {
    const activeCount = await this._autopostRepository.countActiveAutoposts();
    const status = await this.describeWorkflow('autopost-workflows', {
      unit: 'hour',
      interval: 1,
      label: 'Every hour per active autopost (fixed in workflow)',
    }, true);
    return {
      ...status,
      workflowId: 'autopost-workflows',
      exists: activeCount > 0,
      status: activeCount > 0 ? 'ACTIVE_CONFIGS' : 'NONE',
      activeCount,
      note:
        'Trigger now force-runs every active autopost and may generate content or posts.',
    };
  }

  async triggerAutopostWorkflows() {
    await this.startOneShot(
      AUTOPOST_ADMIN_TRIGGER_WORKFLOW_TYPE,
      `${AUTOPOST_ADMIN_TRIGGER_WORKFLOW_ID_PREFIX}-${makeId(8)}`,
      [{}]
    );
    return this.getAutopostWorkflowStatus();
  }

  async getLeadBridgeStatus(): Promise<AdminWorkflowStatus> {
    const idleHours = Math.max(1, Math.round(LEAD_BRIDGE_IDLE_MS / (60 * 60 * 1000)));
    return this.describeWorkflow(LEAD_BRIDGE_WORKFLOW_ID, {
      unit: 'hour',
      interval: idleHours,
      label: `Idle up to ${idleHours} hour(s) when quiet; max ${LEAD_BRIDGE_DAILY_LIMIT} warm crawls per channel per UTC day`,
    });
  }

  async triggerLeadBridge() {
    await this.ensureWorkflowStarted(LEAD_BRIDGE_WORKFLOW_TYPE, LEAD_BRIDGE_WORKFLOW_ID, [
      {},
    ]);
    await this.signalWorkflow(LEAD_BRIDGE_WORKFLOW_ID, 'channelLeadBridge');
    return this.getLeadBridgeStatus();
  }

  private async describeWorkflow(
    workflowId: string,
    cadence: AdminWorkflowCadence,
    skipDescribe = false
  ): Promise<AdminWorkflowStatus> {
    if (skipDescribe) {
      return {
        workflowId,
        exists: false,
        status: 'UNKNOWN',
        cadence,
      };
    }
    try {
      const description = await this.workflowClient()
        .getHandle(workflowId)
        .describe();
      return {
        workflowId,
        exists: true,
        status: description.status.name,
        cadence,
        startedAt:
          description.startTime instanceof Date
            ? description.startTime.toISOString()
            : undefined,
      };
    } catch (error) {
      if (!this.isMissing(error)) {
        throw error;
      }
      return {
        workflowId,
        exists: false,
        status: 'NOT_FOUND',
        cadence,
      };
    }
  }

  private async startOneShot(
    workflowType: string,
    workflowId: string,
    args: unknown[]
  ) {
    await this.ensureWorkflowStarted(workflowType, workflowId, args);
  }

  private async ensureWorkflowStarted(
    workflowType: string,
    workflowId: string,
    args: unknown[]
  ) {
    try {
      await this.workflowClient().start(workflowType, {
        workflowId,
        taskQueue: 'main',
        args,
      });
    } catch (error) {
      if (!this.isAlreadyStarted(error)) {
        throw error;
      }
    }
  }

  private async signalWorkflow(workflowId: string, signalName: string) {
    await this.workflowClient().getHandle(workflowId).signal(signalName);
  }

  private workflowClient() {
    const client = this._temporalService.client?.getRawClient()?.workflow;
    if (!client) {
      throw new Error('Temporal workflow client unavailable');
    }
    return client;
  }

  private isMissing(error: unknown) {
    const value = error as { name?: string; message?: string };
    const message = value?.message?.toLowerCase() || '';
    return (
      value?.name === 'WorkflowNotFoundError' ||
      message.includes('not found')
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
