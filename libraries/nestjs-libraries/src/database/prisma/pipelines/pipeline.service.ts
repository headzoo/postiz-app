import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreatePipelineDto,
  DeletePipelineScheduleSlotDto,
  GetPipelineScheduleDto,
  MovePipelineQueueItemDto,
  ReorderPipelineQueueDto,
  ReorderPipelineQueueItemDto,
  UpdatePipelineScheduleDto,
  UpdatePipelineDto,
} from '@gitroom/nestjs-libraries/dtos/pipelines/pipeline.dto';
import {
  getNextPipelineSlot,
  getPipelineScheduleOccurrencesInRange,
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
      color: pipeline.color,
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

  async getCalendarPosts(
    orgId: string,
    startDate: string,
    endDate: string,
    customer?: string
  ) {
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
        return (item.posts || [])
          .filter((post) => {
            if (!customer) {
              return true;
            }
            return post.integration?.customer?.id === customer;
          })
          .map((post) => ({
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
            pipelineColor: pipeline.color,
            tags: (post.tags || []).map((tag: any) => ({ tag: tag.tag })),
            integration: post.integration
              ? {
                  id: post.integration.id,
                  providerIdentifier: post.integration.providerIdentifier,
                  name: post.integration.name,
                  picture: post.integration.picture,
                  customer: post.integration.customer
                    ? {
                        id: post.integration.customer.id,
                        name: post.integration.customer.name,
                      }
                    : undefined,
                }
              : post.integration,
          }));
      });
    });
  }

  async getPipelineSchedule(
    orgId: string,
    query: GetPipelineScheduleDto
  ) {
    const startDate = dayjs.utc(query.startDate);
    const endDate = dayjs.utc(query.endDate);
    if (!startDate.isValid() || !endDate.isValid()) {
      throw new BadRequestException('Pipeline schedule range must use valid ISO dates');
    }

    const start = startDate.toDate();
    const end = endDate.toDate();
    const duration = end.getTime() - start.getTime();
    if (duration <= 0) {
      throw new BadRequestException('Pipeline schedule endDate must be after startDate');
    }
    if (duration > 8 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Pipeline schedule range cannot exceed eight days');
    }

    const pipelines = await this._pipelineRepository.getPipelinesForSchedule(
      orgId
    );
    return pipelines
      .flatMap((pipeline) =>
        getPipelineScheduleOccurrencesInRange(
          pipeline.scheduleSlots,
          pipeline.timezone,
          start,
          end
        ).map((occurrence) => {
          const scheduledFor = occurrence.scheduledFor.toISOString();
          return {
            id: `${pipeline.id}:${occurrence.dayOfWeek}:${occurrence.minuteOfDay}:${scheduledFor}`,
            pipelineId: pipeline.id,
            pipelineName: pipeline.name,
            pipelineTimezone: pipeline.timezone,
            pipelineColor: pipeline.color,
            active: pipeline.active,
            scheduleRevision: pipeline.scheduleRevision,
            dayOfWeek: occurrence.dayOfWeek,
            minuteOfDay: occurrence.minuteOfDay,
            scheduledFor,
          };
        })
      )
      .sort(
        (first, second) =>
          first.scheduledFor.localeCompare(second.scheduledFor) ||
          first.pipelineName.localeCompare(second.pipelineName) ||
          first.pipelineId.localeCompare(second.pipelineId) ||
          first.dayOfWeek - second.dayOfWeek ||
          first.minuteOfDay - second.minuteOfDay
      );
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
      color: pipeline.color,
      active: pipeline.active,
      scheduleRevision: pipeline.scheduleRevision,
      scheduleSlots: this.toScheduleSlots(pipeline.scheduleSlots),
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
    this.validateMetadata(body);
    await this.validateIntegrations(orgId, body.integrations.map((entry) => entry.id));
    return this._pipelineRepository.createPipeline(orgId, body);
  }

  async updatePipeline(orgId: string, id: string, body: UpdatePipelineDto) {
    this.validateMetadata(body);
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

  async updatePipelineSchedule(
    orgId: string,
    id: string,
    body: UpdatePipelineScheduleDto
  ) {
    this.validateScheduleSlots(body.scheduleSlots);
    const pipeline = await this._pipelineRepository.updatePipelineSchedule(
      orgId,
      id,
      body.scheduleSlots
    );
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return {
      ...pipeline,
      scheduleSlots: this.toScheduleSlots(pipeline.scheduleSlots),
    };
  }

  async deletePipelineScheduleSlot(
    orgId: string,
    id: string,
    slot: DeletePipelineScheduleSlotDto
  ) {
    const result = await this._pipelineRepository.deletePipelineScheduleSlot(
      orgId,
      id,
      slot
    );
    if (result === 'not-found') {
      throw new NotFoundException('Pipeline not found');
    }
    if (result === 'stale') {
      throw new ConflictException('Pipeline schedule slot no longer exists');
    }
    return {
      pipelineId: result.id,
      dayOfWeek: slot.dayOfWeek,
      minuteOfDay: slot.minuteOfDay,
      scheduleRevision: result.scheduleRevision,
    };
  }

  async reorderQueue(
    orgId: string,
    pipelineId: string,
    body: ReorderPipelineQueueDto
  ) {
    if (new Set(body.itemIds).size !== body.itemIds.length) {
      throw new BadRequestException('Pipeline queue item IDs must be unique');
    }
    const result = await this._pipelineRepository.reorderQueuedItems(
      orgId,
      pipelineId,
      body.itemIds
    );
    if (result === null) {
      throw new NotFoundException('Pipeline not found');
    }
    if (result === false) {
      throw new ConflictException('Pipeline queue changed; refresh and try again');
    }
    return result;
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

  private validateMetadata(body: CreatePipelineDto) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
    } catch {
      throw new BadRequestException('Pipeline timezone must be a valid IANA timezone');
    }
    const integrationIds = body.integrations.map((integration) => integration.id);
    if (new Set(integrationIds).size !== integrationIds.length) {
      throw new BadRequestException('Pipeline integrations must be unique');
    }
  }

  private toScheduleSlots(
    scheduleSlots: Array<{ dayOfWeek: number; minuteOfDay: number }>
  ) {
    return scheduleSlots.map(({ dayOfWeek, minuteOfDay }) => ({
      dayOfWeek,
      minuteOfDay,
    }));
  }

  private validateScheduleSlots(
    scheduleSlots: UpdatePipelineScheduleDto['scheduleSlots']
  ) {
    const slotKeys = scheduleSlots.map(
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
