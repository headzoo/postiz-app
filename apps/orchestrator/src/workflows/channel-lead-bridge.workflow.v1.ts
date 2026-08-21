import {
  condition,
  continueAsNew,
  proxyActivities,
  setHandler,
} from '@temporalio/workflow';
import {
  ChannelLeadBridgeActivity,
  ChannelLeadBridgeCandidate,
} from '@gitroom/orchestrator/activities/channel-lead-bridge.activity';
import { channelLeadBridgeSignal } from '@gitroom/orchestrator/signals/channel-lead-bridge.signal';
import { LEAD_BRIDGE_IDLE_MS } from '@gitroom/nestjs-libraries/temporal/lead-bridge.schedule';

export type ChannelLeadBridgeWorkflowV1Request = {
  after?: string;
};

const { listDueCandidatesV1, crawlNextWarmFollowerV1 } =
  proxyActivities<ChannelLeadBridgeActivity>({
    startToCloseTimeout: '2 minutes',
    taskQueue: 'main',
    retry: {
      maximumAttempts: 3,
      initialInterval: '10 seconds',
      backoffCoefficient: 2,
    },
  });

export async function channelLeadBridgeWorkflowV1(
  request: ChannelLeadBridgeWorkflowV1Request = {}
): Promise<never> {
  let poked = false;
  setHandler(channelLeadBridgeSignal, () => {
    poked = true;
  });

  const discovered = await listDueCandidatesV1({ after: request.after });
  const candidate = discovered.candidates[0] as
    | ChannelLeadBridgeCandidate
    | undefined;

  if (!candidate) {
    await condition(() => poked, LEAD_BRIDGE_IDLE_MS);
    return continueAsNew<typeof channelLeadBridgeWorkflowV1>({});
  }

  try {
    await crawlNextWarmFollowerV1({ candidate });
  } catch {
    // Activity retries run first; isolate a persistently failing integration.
  }

  return continueAsNew<typeof channelLeadBridgeWorkflowV1>(
    poked ? {} : { after: candidate.id }
  );
}
