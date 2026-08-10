export type PipelineSlotSkipReason =
  | 'DUPLICATE'
  | 'EMPTY'
  | 'INACTIVE'
  | 'MISSED'
  | 'STALE_REVISION'
  | 'STALE_SLOT';

export interface DiscoverDuePipelineSlotsRequest {
  readonly nowUtc: string;
  readonly maximumCandidates: number;
  readonly after?: {
    readonly scheduledFor: string;
    readonly pipelineId: string;
  };
}

export interface DuePipelineSlot {
  readonly occurrenceId: string;
  readonly pipelineId: string;
  readonly scheduleRevision: number;
  readonly scheduledFor: string;
}

export interface DiscoverDuePipelineSlotsResponse {
  readonly candidates: readonly DuePipelineSlot[];
  readonly next?: {
    readonly scheduledFor: string;
    readonly pipelineId: string;
  };
}

export interface ClaimPipelineSlotRequest {
  readonly pipelineId: string;
  readonly scheduleRevision: number;
  readonly scheduledFor: string;
  readonly nowUtc: string;
}

export interface ClaimedPipelinePostRoot {
  readonly postId: string;
  readonly organizationId: string;
  readonly taskQueue: string;
}

export interface ClaimPipelineSlotResponse {
  readonly outcome: 'CLAIMED' | 'SKIPPED' | 'FAILED';
  readonly executionId?: string;
  readonly queueItemId?: string;
  readonly roots: readonly ClaimedPipelinePostRoot[];
  readonly reason?: PipelineSlotSkipReason | string;
  readonly replayed?: boolean;
}

export interface FinalizePipelineSlotRequest {
  readonly executionId: string;
}

export interface FinalizePipelineSlotResponse {
  readonly outcome: 'PUBLISHED' | 'FAILED' | 'NOOP';
  readonly reason?: string;
}

export interface PipelineSlotWorkflowV1Request {
  readonly pipelineId: string;
  readonly scheduleRevision: number;
  readonly scheduledFor: string;
}

export interface PipelineSchedulerWorkflowV1Request {
  readonly iteration?: number;
}
