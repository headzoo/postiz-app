export const POST_RULE_ACTIONS = [
  'REMOVE',
  'AUTO_REPOST',
  'AUTO_PLUG',
] as const;
export type PostRuleAction = (typeof POST_RULE_ACTIONS)[number];

export const POST_RULE_CONDITION_MATCHES = ['ANY', 'ALL'] as const;
export type PostRuleConditionMatch =
  (typeof POST_RULE_CONDITION_MATCHES)[number];

export const POST_RULE_CONDITION_METRICS = ['LIKES', 'REPLIES'] as const;
export type PostRuleConditionMetric =
  (typeof POST_RULE_CONDITION_METRICS)[number];

export const POST_RULE_CONDITION_OPERATORS = [
  'LT',
  'LTE',
  'GT',
  'GTE',
] as const;
export type PostRuleConditionOperator =
  (typeof POST_RULE_CONDITION_OPERATORS)[number];

export const POST_RULE_RESCHEDULE_MODES = ['MANUAL', 'PIPELINE'] as const;
export type PostRuleRescheduleMode =
  (typeof POST_RULE_RESCHEDULE_MODES)[number];

export const POST_RULE_RUN_STATUSES = [
  'ACTIVE',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;
export type PostRuleRunStatus = (typeof POST_RULE_RUN_STATUSES)[number];

export const POST_RULE_EVALUATION_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'SKIPPED',
  'FAILED',
] as const;
export type PostRuleEvaluationStatus =
  (typeof POST_RULE_EVALUATION_STATUSES)[number];

export type PostRuleCondition = {
  metric: PostRuleConditionMetric;
  operator: PostRuleConditionOperator;
  threshold: number;
};

export type PostRuleManualRescheduleConfig = {
  mode: 'MANUAL';
  daysAfterEvaluation: number;
  timeOfDay: string;
  timezone: string;
};

export type PostRulePipelineRescheduleConfig = {
  mode: 'PIPELINE';
  pipelineId: string;
};

export type PostRuleRescheduleConfig =
  | PostRuleManualRescheduleConfig
  | PostRulePipelineRescheduleConfig;

export type PostRuleRemoveActionConfig = Record<string, never>;

export type PostRuleAutoRepostActionConfig = Record<string, never>;

export type PostRuleAutoPlugActionConfig = {
  content: string;
};

export type PostRuleActionConfig =
  | PostRuleRemoveActionConfig
  | PostRuleAutoRepostActionConfig
  | PostRuleAutoPlugActionConfig;

export type PostRuleNormalizedMetrics = {
  likes?: number;
  replies?: number;
};

export type PostRuleSnapshot = {
  ruleId: string;
  name: string;
  action: PostRuleAction;
  conditionMatch: PostRuleConditionMatch;
  conditions: PostRuleCondition[];
  rescheduleMode: PostRuleRescheduleMode | null;
  maxRescheduleAttempts: number | null;
  rescheduleAttempt: number;
  lineageId: string;
};

export type PostRuleEvaluationActionResult = {
  matched: boolean;
  action?: string;
  skippedReason?: string;
  successorPostId?: string;
  remoteReleaseIds?: string[];
  failedReleaseIds?: string[];
  attemptLimitReached?: boolean;
  message?: string;
  rule?: PostRuleSnapshot;
};

export interface PostRuleResponse {
  id: string;
  name: string;
  enabled: boolean;
  action: PostRuleAction;
  initialDelayHours: number;
  evaluationIntervalHours: number | null;
  maxEvaluations: number | null;
  conditionMatch: PostRuleConditionMatch;
  conditions: PostRuleCondition[];
  actionConfig: PostRuleActionConfig;
  rescheduleConfig: PostRuleRescheduleConfig | null;
  maxRescheduleAttempts: number | null;
  integrationIds: string[];
  pipelineIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PostRuleListItemResponse {
  id: string;
  name: string;
  enabled: boolean;
  action: PostRuleAction;
  initialDelayHours: number;
  evaluationIntervalHours: number | null;
  maxEvaluations: number | null;
  conditionMatch: PostRuleConditionMatch;
  conditions: PostRuleCondition[];
  integrationIds: string[];
  integrationCount: number;
  pipelineCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostRuleCapabilityMetricResponse {
  key: PostRuleConditionMetric;
  label: string;
}

export interface PostRuleCapabilityActionResponse {
  key: PostRuleAction;
  label: string;
  metrics: PostRuleCapabilityMetricResponse[];
}

export interface PostRuleProviderCapabilitiesResponse {
  providerIdentifier: string;
  actions: PostRuleAction[];
  metrics: PostRuleConditionMetric[];
}

export interface PostRuleCapabilitiesResponse {
  actions: PostRuleCapabilityActionResponse[];
  providers: PostRuleProviderCapabilitiesResponse[];
}

export interface PostRuleWorkItem {
  runId: string;
  ruleId: string;
  postId: string;
  evaluationIndex: number;
  delayMs: number;
}

export interface PostRuleEvaluationWorkResult {
  runId: string;
  evaluationIndex: number;
  status: PostRuleEvaluationStatus;
  terminalRun: boolean;
  actionResult?: PostRuleEvaluationActionResult;
  errorSummary?: string;
}

export interface ResolvePostRulesRequest {
  organizationId: string;
  postId: string;
  integrationId: string;
}

export interface ResolvePostRulesResponse {
  items: PostRuleWorkItem[];
}

export interface ProcessPostRuleEvaluationRequest {
  organizationId: string;
  runId: string;
  evaluationIndex: number;
}
