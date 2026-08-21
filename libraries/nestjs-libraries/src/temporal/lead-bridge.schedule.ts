const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const LEAD_BRIDGE_WORKFLOW_TYPE = 'channelLeadBridgeWorkflowV1';
export const LEAD_BRIDGE_WORKFLOW_ID = 'channel-lead-bridge-workflow-v1';

/** Max warm followers whose follower lists we crawl per integration per UTC day. */
export const LEAD_BRIDGE_DAILY_LIMIT = 5;
export const LEAD_BRIDGE_PAGE_SIZE = 100;
export const LEAD_BRIDGE_WARM_GRADE_THRESHOLD = 3.5;
/** Idle wait when no integrations have remaining daily crawl quota. */
export const LEAD_BRIDGE_IDLE_MS = 60 * 60 * 1000;

export const leadBridgeDailyCountKey = (integrationId: string, day: string) =>
  `lead-bridge-crawl:${integrationId}:${day}`;

export const leadBridgeCursorKey = (integrationId: string) =>
  `lead-bridge-cursor:${integrationId}`;

export const utcDayKey = (now = new Date()) =>
  now.toISOString().slice(0, 10);

export const leadBridgeDailyTtlSeconds = () => Math.ceil(DAY_MS / 1000);
