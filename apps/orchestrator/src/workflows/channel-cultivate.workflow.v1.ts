import {
  condition,
  continueAsNew,
  proxyActivities,
  setHandler,
} from '@temporalio/workflow';
import {
  ChannelCultivateActivity,
  ChannelCultivateCandidate,
} from '@gitroom/orchestrator/activities/channel-cultivate.activity';
import { channelCultivateSignal } from '@gitroom/orchestrator/signals/channel-cultivate.signal';
import { CULTIVATE_IDLE_MS } from '@gitroom/nestjs-libraries/temporal/cultivate.schedule';

export type ChannelCultivateWorkflowV1Request = {
  after?: string;
};

const { listDueCandidatesV1, materializeDailyPicksV1 } =
  proxyActivities<ChannelCultivateActivity>({
    startToCloseTimeout: '2 minutes',
    taskQueue: 'main',
    retry: {
      maximumAttempts: 3,
      initialInterval: '10 seconds',
      backoffCoefficient: 2,
    },
  });

export async function channelCultivateWorkflowV1(
  request: ChannelCultivateWorkflowV1Request = {}
): Promise<never> {
  let poked = false;
  setHandler(channelCultivateSignal, () => {
    poked = true;
  });

  const discovered = await listDueCandidatesV1({ after: request.after });
  const candidate = discovered.candidates[0] as
    | ChannelCultivateCandidate
    | undefined;

  if (!candidate) {
    await condition(() => poked, CULTIVATE_IDLE_MS);
    return continueAsNew<typeof channelCultivateWorkflowV1>({});
  }

  try {
    await materializeDailyPicksV1({ candidate });
  } catch {
    // Activity retries run first; isolate a persistently failing integration.
  }

  return continueAsNew<typeof channelCultivateWorkflowV1>(
    poked ? {} : { after: candidate.id }
  );
}
