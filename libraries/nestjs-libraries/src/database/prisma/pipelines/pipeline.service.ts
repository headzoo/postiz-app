import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreatePipelineDto,
  MovePipelineQueueItemDto,
  ReorderPipelineQueueItemDto,
  UpdatePipelineDto,
} from '@gitroom/nestjs-libraries/dtos/pipelines/pipeline.dto';
import {
  getNextPipelineSlot,
  getUpcomingPipelineSlots,
} from './pipeline.schedule';
import { PipelineRepository } from './pipeline.repository';
import { PipelineManager } from './pipeline.manager';
import { socialIntegrationList } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

@Injectable()
export class PipelineService {
  constructor(
    private _pipelineRepository: PipelineRepository,
    private _pipelineManager: PipelineManager
  ) {}

  async getPipelines(orgId: string) {
    const pipelines = await this._pipelineRepository.getPipelines(orgId);
    const now = new Date();
    return pipelines.map((pipeline) => ({
      id: pipeline.id,
      name: pipeline.name,
      timezone: pipeline.timezone,
      active: pipeline.active,
      scheduleRevision: pipeline.scheduleRevision,
      channels: pipeline.integrations.map(({ integration }) =>
        this.toComposerIntegration(integration)
      ),
      queueCount: pipeline._count.queueItems,
      nextSlot: pipeline.active
        ? getNextPipelineSlot(pipeline.scheduleSlots, pipeline.timezone, now)
        : undefined,
    }));
  }

  async getCalendarPosts(orgId: string, startDate: string, endDate: string) {
    const start = dayjs.utc(startDate);
    const end = dayjs.utc(endDate);
    if (!start.isValid() || !end.isValid()) {
      return [];
    }

    const startTime = start.toDate();
    const endTime = end.toDate();
    const now = new Date();
    const pipelines = await this._pipelineRepository.getActivePipelinesForCalendar(
      orgId
    );

    return pipelines.flatMap((pipeline) => {
      const slots = getUpcomingPipelineSlots(
        pipeline.scheduleSlots,
        pipeline.timezone,
        now,
        pipeline.queueItems.length
      );

      return pipeline.queueItems.flatMap((item, index) => {
        const projectedFor = slots[index];
        if (
          !projectedFor ||
          projectedFor.getTime() < startTime.getTime() ||
          projectedFor.getTime() > endTime.getTime()
        ) {
          return [];
        }

        const publishDate = projectedFor.toISOString();
        return (item.posts || []).map((post) => ({
          id: post.id,
          content: post.content,
          publishDate,
          releaseURL: null,
          releaseId: null,
          state: post.state,
          intervalInDays: null,
          group: item.group,
          creationMethod: 'QUEUE',
          pipelineId: pipeline.id,
          pipelineItemId: item.id,
          tags: (post.tags || []).map((tag: any) => ({ tag: tag.tag })),
          integration: post.integration
            ? {
                id: post.integration.id,
                providerIdentifier: post.integration.providerIdentifier,
                name: post.integration.name,
                picture: post.integration.picture,
              }
            : post.integration,
        }));
      });
    });
  }

  async getPipeline(orgId: string, id: string) {
    const pipeline = await this._pipelineRepository.getPipeline(orgId, id);
    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }
    const slots = pipeline.active
      ? getUpcomingPipelineSlots(pipeline.scheduleSlots, pipeline.timezone, new Date(), pipeline.queueItems.length)
      : [];
    let slotIndex = 0;
    return {
      id: pipeline.id,
      name: pipeline.name,
      timezone: pipeline.timezone,
      active: pipeline.active,
      scheduleRevision: pipeline.scheduleRevision,
      scheduleSlots: pipeline.scheduleSlots,
      channels: pipeline.integrations.map(({ integration }) =>
        this.toComposerIntegration(integration)
      ),
      queueItems: pipeline.queueItems.map((item) => ({
        id: item.id,
        group: item.group,
        status: item.status,
        position: item.position,
        error: item.error,
        posts: (item.posts || []).map((post) => this.toComposerPost(post)),
      })),
      nextSlot: slots[0],
      projections: pipeline.queueItems.map((item) => ({
        itemId: item.id,
        projectedFor:
          item.status === 'QUEUED' ? slots[slotIndex++] : undefined,
      })),
    };
  }

  async createPipeline(orgId: string, body: CreatePipelineDto) {
    this.validateConfiguration(body);
    await this.validateIntegrations(orgId, body.integrations.map((entry) => entry.id));
    return this._pipelineRepository.createPipeline(orgId, body);
  }

  async updatePipeline(orgId: string, id: string, body: UpdatePipelineDto) {
    this.validateConfiguration(body);
    await this.validateIntegrations(orgId, body.integrations.map((entry) => entry.id));
    const pipeline = await this._pipelineRepository.updatePipeline(orgId, id, body);
    if (pipeline === false) {
      throw new ConflictException(
        'Pipeline integrations cannot change while queued items reference them'
      );
    }
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return pipeline;
  }

  async setActive(orgId: string, id: string, active: boolean) {
    const result = await this._pipelineRepository.setActive(orgId, id, active);
    if (!result.count) throw new NotFoundException('Pipeline not found');
    return { active };
  }

  async deletePipeline(orgId: string, id: string) {
    const pipeline = await this._pipelineRepository.deletePipeline(orgId, id);
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return { id: pipeline.id, detached: true };
  }

  enqueue(orgId: string, body: Parameters<PipelineManager['enqueue']>[1]) {
    return this._pipelineManager.enqueue(orgId, body);
  }

  async reorderItem(
    orgId: string,
    pipelineId: string,
    itemId: string,
    body: ReorderPipelineQueueItemDto
  ) {
    this.validatePlacement(body);
    const item = await this._pipelineRepository.repositionItem(
      orgId,
      itemId,
      pipelineId,
      body.beforeItemId,
      body.afterItemId
    );
    if (!item) throw new NotFoundException('Queued Pipeline item not found');
    return item;
  }

  async moveItem(orgId: string, itemId: string, body: MovePipelineQueueItemDto) {
    this.validatePlacement(body);
    const item = await this._pipelineRepository.moveItem(
      orgId,
      itemId,
      body.destinationPipelineId,
      body.beforeItemId,
      body.afterItemId
    );
    if (item === false) {
      throw new ConflictException(
        'The destination Pipeline must have exactly the same integrations'
      );
    }
    if (!item) throw new NotFoundException('Queued Pipeline item or destination not found');
    return item;
  }

  async detachItem(orgId: string, itemId: string) {
    const item = await this._pipelineRepository.detachItem(orgId, itemId);
    if (!item) throw new NotFoundException('Queued Pipeline item not found');
    return item;
  }

  async deleteItem(orgId: string, itemId: string) {
    const item = await this._pipelineRepository.deleteItem(orgId, itemId);
    if (!item) throw new NotFoundException('Queued Pipeline item not found');
    return item;
  }

  async publishNow(orgId: string, itemId: string) {
    return this.scheduleItem(orgId, itemId, new Date().toISOString());
  }

  async scheduleItem(orgId: string, itemId: string, date: string) {
    const scheduledFor = new Date(date);
    if (Number.isNaN(scheduledFor.getTime())) {
      throw new BadRequestException('Pipeline schedule date must be valid');
    }
    const item = await this._pipelineRepository.scheduleItem(
      orgId,
      itemId,
      scheduledFor
    );
    if (!item) throw new NotFoundException('Queued Pipeline item not found');
    await this._pipelineManager.startScheduledPosts(orgId, item.posts);
    return { id: item.id, scheduledFor: scheduledFor.toISOString() };
  }

  private validateConfiguration(body: CreatePipelineDto) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
    } catch {
      throw new BadRequestException('Pipeline timezone must be a valid IANA timezone');
    }
    const integrationIds = body.integrations.map((integration) => integration.id);
    if (new Set(integrationIds).size !== integrationIds.length) {
      throw new BadRequestException('Pipeline integrations must be unique');
    }
    const slotKeys = body.scheduleSlots.map(
      (slot) => `${slot.dayOfWeek}:${slot.minuteOfDay}`
    );
    if (new Set(slotKeys).size !== slotKeys.length) {
      throw new BadRequestException('Pipeline schedule slots must be unique');
    }
  }

  private async validateIntegrations(orgId: string, integrationIds: string[]) {
    const integrations = await this._pipelineRepository.getOwnedIntegrations(
      orgId,
      integrationIds
    );
    if (integrations.length !== integrationIds.length) {
      throw new BadRequestException(
        'Pipeline integrations must belong to the organization and be enabled'
      );
    }
  }

  private validatePlacement(body: ReorderPipelineQueueItemDto) {
    if (body.beforeItemId && body.afterItemId) {
      throw new BadRequestException('Specify either beforeItemId or afterItemId');
    }
  }

  private toComposerIntegration(integration: any) {
    const provider = socialIntegrationList.find(
      (candidate) => candidate.identifier === integration.providerIdentifier
    );
    return {
      id: integration.id,
      name: integration.name,
      disabled: integration.disabled,
      editor: provider?.editor || 'normal',
      stripLinks: !!provider?.stripLinks?.(),
      picture: integration.picture || '/no-picture.jpg',
      identifier: integration.providerIdentifier,
      inBetweenSteps: integration.inBetweenSteps,
      display: integration.profile,
      type: integration.type,
      time: this.parseJson(integration.postingTimes, []),
      changeProfilePicture: !!provider?.changeProfilePicture,
      changeNickName: !!provider?.changeNickname,
      customer: integration.customer,
      additionalSettings: integration.additionalSettings || '[]',
    };
  }

  private toComposerPost(post: any) {
    return {
      id: post.id,
      parentPostId: post.parentPostId,
      content: post.content,
      delay: post.delay,
      state: post.state,
      intervalInDays: post.intervalInDays,
      settings: this.parseJson(post.settings, {}),
      image: this.parseJson(post.image, []),
      tags: post.tags,
      integration: this.toComposerIntegration(post.integration),
    };
  }

  private parseJson<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
}
