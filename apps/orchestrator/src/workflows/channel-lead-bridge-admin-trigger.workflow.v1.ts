import { continueAsNew, proxyActivities } from '@temporalio/workflow';
import { ChannelLeadBridgeActivity } from '@gitroom/orchestrator/activities/channel-lead-bridge.activity';
import { LEAD_BRIDGE_ADMIN_BURST_MIN_APPLIED } from '@gitroom/nestjs-libraries/temporal/lead-bridge.schedule';

export type ChannelLeadBridgeAdminTriggerWorkflowV1Request = {
  cleared?: boolean;
  applied?: number;
  after?: string;
};

const {
  clearDiscoveredLeadsV1,
  crawlNextWarmFollowerBurstV1,
  resumeIdleLeadBridgeV1,
} = proxyActivities<ChannelLeadBridgeActivity>({
  startToCloseTimeout: '5 minutes',
  taskQueue: 'main',
  retry: {
    maximumAttempts: 3,
    initialInterval: '10 seconds',
    backoffCoefficient: 2,
  },
});

export async function channelLeadBridgeAdminTriggerWorkflowV1(
  request: ChannelLeadBridgeAdminTriggerWorkflowV1Request = {}
): Promise<void> {
  if (!request.cleared) {
    await clearDiscoveredLeadsV1();
    return continueAsNew<typeof channelLeadBridgeAdminTriggerWorkflowV1>({
      cleared: true,
      applied: 0,
    });
  }

  const applied = Math.max(0, request.applied ?? 0);
  if (applied >= LEAD_BRIDGE_ADMIN_BURST_MIN_APPLIED) {
    await resumeIdleLeadBridgeV1({
      applied,
      reachedTarget: true,
    });
    return;
  }

  const remaining = LEAD_BRIDGE_ADMIN_BURST_MIN_APPLIED - applied;
  const crawl = await crawlNextWarmFollowerBurstV1({
    after: request.after,
    maxApplied: remaining,
  });

  if (crawl.exhausted || !crawl.candidateId) {
    await resumeIdleLeadBridgeV1({
      applied,
      reachedTarget: false,
    });
    return;
  }

  const nextApplied = applied + Math.max(0, crawl.applied || 0);
  if (nextApplied >= LEAD_BRIDGE_ADMIN_BURST_MIN_APPLIED) {
    await resumeIdleLeadBridgeV1({
      applied: nextApplied,
      reachedTarget: true,
    });
    return;
  }

  return continueAsNew<typeof channelLeadBridgeAdminTriggerWorkflowV1>({
    cleared: true,
    applied: nextApplied,
    after: crawl.candidateId,
  });
}
