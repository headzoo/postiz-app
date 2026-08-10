import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';

export interface PipelineScheduleSlot {
  dayOfWeek: number;
  minuteOfDay: number;
}

export interface PipelineSummary {
  id: string;
  name: string;
  timezone: string;
  active: boolean;
  scheduleRevision: number;
  channels: Integrations[];
  queueCount: number;
  nextSlot?: string;
}

export interface PipelineDetail extends PipelineSummary {
  scheduleSlots: PipelineScheduleSlot[];
  integrations: { integrationId: string; integration: Integrations }[];
  queueItems: PipelineQueueItem[];
  projections: { itemId: string; projectedFor?: string }[];
}

export interface PipelineQueueItem {
  id: string;
  group: string;
  status: 'QUEUED' | 'PUBLISHING' | 'FAILED' | 'PUBLISHED' | 'REMOVED';
  position: number;
  error?: string | null;
  posts: Array<{
    id: string;
    parentPostId?: string | null;
    content: string;
    delay: number;
    state?: string;
    intervalInDays?: number | null;
    integration: Integrations;
    settings?: Record<string, unknown>;
    image?: Array<{
      id: string;
      path: string;
      alt?: string;
      thumbnail?: string;
      thumbnailTimestamp?: number;
    }>;
    tags?: Array<{ tag: { name: string } }>;
  }>;
}

export interface CreatePipelinePayload {
  name: string;
  timezone: string;
  integrations: { id: string }[];
}

export type UpdatePipelinePayload = CreatePipelinePayload;

export interface UpdatePipelineSchedulePayload {
  scheduleSlots: PipelineScheduleSlot[];
}

export interface ReorderPipelineQueuePayload {
  itemIds: string[];
}
