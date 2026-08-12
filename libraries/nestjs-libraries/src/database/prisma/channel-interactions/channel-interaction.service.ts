import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChannelAudienceMembership as PrismaAudienceMembership,
  ChannelInteractionDirection as PrismaInteractionDirection,
  ChannelInteractionKind as PrismaInteractionKind,
  ChannelInteractionWindow as PrismaInteractionWindow,
} from '@prisma/client';
import {
  ChannelInteractionDirection,
  ChannelInteractionKind,
  ChannelInteractionWindow,
  ChannelWebhookChallengeRequest,
  ChannelWebhookDeliveryRequest,
  Follower,
  NormalizedChannelInteractionEvent,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { Integration } from '@prisma/client';
import {
  AudienceProfile,
  ChannelInteractionRepository,
  DesiredInteractionSubscription,
} from './channel-interaction.repository';
import {
  calculateRelationshipGrade,
  getChannelInteractionScore,
} from './channel-interaction.scoring';

export {
  calculateRelationshipGrade,
  getChannelInteractionScore,
} from './channel-interaction.scoring';

const MAX_DELIVERY_EVENTS = 500;
const MAX_METADATA_ENTRIES = 32;
const MAX_FUTURE_SKEW_MS = 10 * 60 * 1000;
const MAX_ID_LENGTH = 512;
const MAX_PROFILE_TEXT_LENGTH = 4096;
const MAX_METADATA_VALUE_LENGTH = 2048;
const MAX_AUDIENCE_NOTE_LENGTH = 4096;

const KIND_MAP: Record<ChannelInteractionKind, PrismaInteractionKind> = {
  like: PrismaInteractionKind.LIKE,
  reply: PrismaInteractionKind.REPLY,
  repost: PrismaInteractionKind.REPOST,
  follow: PrismaInteractionKind.FOLLOW,
  mention: PrismaInteractionKind.MENTION,
};

const DIRECTION_MAP: Record<
  ChannelInteractionDirection,
  PrismaInteractionDirection
> = {
  inbound: PrismaInteractionDirection.INBOUND,
  outbound: PrismaInteractionDirection.OUTBOUND,
};

const MEMBERSHIP_MAP = {
  follower: PrismaAudienceMembership.FOLLOWER,
  not_follower: PrismaAudienceMembership.NOT_FOLLOWER,
  unknown: PrismaAudienceMembership.UNKNOWN,
} as const;

const WINDOW_MAP: Record<ChannelInteractionWindow, {
  prisma: PrismaInteractionWindow;
  days: number;
}> = {
  week: { prisma: PrismaInteractionWindow.WEEK, days: 7 },
  month: { prisma: PrismaInteractionWindow.MONTH, days: 30 },
  '90_day': { prisma: PrismaInteractionWindow.NINETY_DAY, days: 90 },
  year: { prisma: PrismaInteractionWindow.YEAR, days: 365 },
};

@Injectable()
export class ChannelInteractionService {
  constructor(
    private _repository: ChannelInteractionRepository,
    private _integrationManager?: IntegrationManager
  ) {}

  async handleChallenge(
    providerIdentifier: string,
    request: ChannelWebhookChallengeRequest
  ) {
    const capability = this.getWebhookCapability(providerIdentifier);
    return capability.verifyChallenge(request);
  }

  async handleDelivery(
    providerIdentifier: string,
    request: ChannelWebhookDeliveryRequest
  ) {
    const capability = this.getWebhookCapability(providerIdentifier);
    const delivery = await capability.verifyAndNormalizeDelivery(request);
    if (!delivery.accepted) {
      return delivery;
    }

    const integrations = await this._repository.getActiveIntegrationsForAccount(
      providerIdentifier,
      delivery.connectedAccountId
    );
    await Promise.all(
      integrations.map((integration) =>
        this.recordNormalizedDelivery(
          integration.organizationId,
          integration.id,
          delivery.events
        )
      )
    );
    return delivery;
  }

  async requestReconciliation(integration: Integration) {
    const capability = this.getWebhookCapabilityOrUndefined(
      integration.providerIdentifier
    );
    if (!capability || integration.type !== 'social') {
      return false;
    }
    const desiredSubscriptions: DesiredInteractionSubscription[] =
      capability.getDesiredSubscriptions(integration).map((subscription) => ({
        eventKey: subscription.eventKey,
        direction: DIRECTION_MAP[subscription.direction],
      }));
    await this._repository.requestSubscriptionReconciliation(
      integration.organizationId,
      integration.id,
      desiredSubscriptions
    );
    return true;
  }

  async requestSubscriptionRemoval(integration: Integration) {
    if (
      integration.type !== 'social' ||
      !this.getWebhookCapabilityOrUndefined(integration.providerIdentifier)
    ) {
      return false;
    }
    await this._repository.markSubscriptionsForRemoval(
      integration.organizationId,
      integration.id
    );
    return true;
  }

  async recordNormalizedDelivery(
    organizationId: string,
    integrationId: string,
    events: NormalizedChannelInteractionEvent[]
  ) {
    if (!Array.isArray(events) || events.length > MAX_DELIVERY_EVENTS) {
      throw new BadRequestException(
        `A delivery may contain at most ${MAX_DELIVERY_EVENTS} events`
      );
    }
    const normalized = events.map((event) => this.validateEvent(event));
    let created = 0;
    let duplicates = 0;
    let membershipOnly = 0;

    for (const event of normalized) {
      if (
        event.kind === PrismaInteractionKind.FOLLOW &&
        event.membershipUpdate === PrismaAudienceMembership.NOT_FOLLOWER
      ) {
        await this._repository.applyMembershipUpdate(
          organizationId,
          integrationId,
          event.counterparty,
          PrismaAudienceMembership.NOT_FOLLOWER
        );
        membershipOnly++;
        continue;
      }
      const result = await this._repository.recordNormalizedEvent(
        organizationId,
        integrationId,
        event
      );
      result.created ? created++ : duplicates++;
    }
    return { created, duplicates, membershipOnly };
  }

  async beginFollowerSync(organizationId: string, integrationId: string) {
    const generation = randomUUID();
    await this._repository.beginFollowerSync(
      organizationId,
      integrationId,
      generation
    );
    return generation;
  }

  async applyFollowerSync(
    organizationId: string,
    integrationId: string,
    generation: string,
    followers: Follower[]
  ) {
    this.validateGeneration(generation);
    if (!Array.isArray(followers) || followers.length > MAX_DELIVERY_EVENTS) {
      throw new BadRequestException(
        `A follower sync page may contain at most ${MAX_DELIVERY_EVENTS} followers`
      );
    }
    const profiles = followers.map((follower) => this.validateFollower(follower));
    const applied = await this._repository.applyFollowerSyncPage(
      organizationId,
      integrationId,
      generation,
      profiles
    );
    if (!applied) {
      throw new ConflictException('Follower sync generation is no longer active');
    }
    return { applied: profiles.length };
  }

  async completeFollowerSync(
    organizationId: string,
    integrationId: string,
    generation: string,
    completedAt = new Date()
  ) {
    this.validateGeneration(generation);
    const completed = await this._repository.completeFollowerSync(
      organizationId,
      integrationId,
      generation,
      completedAt
    );
    if (!completed) {
      throw new ConflictException('Follower sync generation is no longer active');
    }
    return { generation, completedAt };
  }

  failFollowerSync(
    organizationId: string,
    integrationId: string,
    generation: string
  ) {
    this.validateGeneration(generation);
    return this._repository.failFollowerSync(
      organizationId,
      integrationId,
      generation
    );
  }

  rebuildWindowSummary(
    organizationId: string,
    integrationId: string,
    window: ChannelInteractionWindow,
    computedAt = new Date()
  ) {
    const definition = WINDOW_MAP[window];
    if (!definition) {
      throw new BadRequestException('Unsupported interaction window');
    }
    const cutoffAt = new Date(
      computedAt.getTime() - definition.days * 24 * 60 * 60 * 1000
    );
    return this._repository.rebuildWindowSummary(
      organizationId,
      integrationId,
      definition.prisma,
      randomUUID(),
      cutoffAt,
      computedAt
    );
  }

  async buildRelationshipGradeSnapshotBatch(
    organizationId: string,
    integrationId: string,
    snapshotAt = new Date()
  ) {
    if (Number.isNaN(snapshotAt.getTime())) {
      throw new BadRequestException('snapshotAt must be a valid timestamp');
    }
    const batch = await this._repository.getDueRelationshipGradeBatch(
      organizationId,
      integrationId,
      snapshotAt
    );
    const snapshots = batch.members.map((member) => {
      const grade = calculateRelationshipGrade(
        member.effortScore,
        member.reciprocationScore
      );
      return {
        externalId: member.externalId,
        effortScore: member.effortScore,
        reciprocationScore: member.reciprocationScore,
        ...grade,
      };
    });
    await this._repository.createRelationshipGradeSnapshots(
      organizationId,
      integrationId,
      snapshotAt,
      snapshots
    );
    return {
      snapshotAt,
      processed: snapshots.length,
      hasMore: await this._repository.hasDueRelationshipGradeMembers(
        organizationId,
        integrationId,
        snapshotAt
      ),
    };
  }

  async getFollowerDetails(
    organizationId: string,
    integrationId: string,
    externalId: string
  ) {
    this.validateBoundedString(externalId, 'externalId', MAX_ID_LENGTH);
    const details = await this._repository.getFollowerDetails(
      organizationId,
      integrationId,
      externalId
    );
    if (!details) {
      throw new NotFoundException('Follower was not found');
    }
    return details;
  }

  async createFollowerNote(
    organizationId: string,
    integrationId: string,
    externalId: string,
    authorUserId: string,
    content: string
  ) {
    this.validateBoundedString(externalId, 'externalId', MAX_ID_LENGTH);
    this.validateBoundedString(
      authorUserId,
      'authorUserId',
      MAX_ID_LENGTH
    );
    this.validateBoundedString(content, 'content', MAX_AUDIENCE_NOTE_LENGTH);
    try {
      return await this._repository.createAudienceNote(
        organizationId,
        integrationId,
        externalId,
        authorUserId,
        content
      );
    } catch {
      throw new NotFoundException('Follower was not found');
    }
  }

  async updateFollowerNote(
    organizationId: string,
    integrationId: string,
    noteId: string,
    content: string
  ) {
    this.validateBoundedString(noteId, 'noteId', MAX_ID_LENGTH);
    this.validateBoundedString(content, 'content', MAX_AUDIENCE_NOTE_LENGTH);
    if (!await this._repository.updateAudienceNote(
      organizationId,
      integrationId,
      noteId,
      content
    )) {
      throw new NotFoundException('Follower note was not found');
    }
  }

  async deleteFollowerNote(
    organizationId: string,
    integrationId: string,
    noteId: string
  ) {
    this.validateBoundedString(noteId, 'noteId', MAX_ID_LENGTH);
    if (!await this._repository.deleteAudienceNote(
      organizationId,
      integrationId,
      noteId
    )) {
      throw new NotFoundException('Follower note was not found');
    }
  }

  private validateEvent(event: NormalizedChannelInteractionEvent) {
    if (!event || typeof event !== 'object') {
      throw new BadRequestException('Interaction event must be an object');
    }
    this.validateBoundedString(event.providerEventKey, 'providerEventKey', MAX_ID_LENGTH);
    this.validateBoundedString(
      event.counterparty?.externalId,
      'counterparty.externalId',
      MAX_ID_LENGTH
    );
    const kind = KIND_MAP[event.kind];
    const direction = DIRECTION_MAP[event.direction];
    if (!kind || !direction) {
      throw new BadRequestException('Unsupported interaction kind or direction');
    }
    const eventAt = this.parseDate(event.eventAt, 'eventAt');
    if (eventAt.getTime() > Date.now() + MAX_FUTURE_SKEW_MS) {
      throw new BadRequestException('Interaction timestamp is too far in the future');
    }
    if (
      !Number.isInteger(event.normalizationVersion) ||
      event.normalizationVersion < 1 ||
      event.normalizationVersion > 1000
    ) {
      throw new BadRequestException('normalizationVersion must be between 1 and 1000');
    }
    if (event.relatedObjectId !== undefined) {
      this.validateBoundedString(
        event.relatedObjectId,
        'relatedObjectId',
        MAX_ID_LENGTH
      );
    }
    const metadataEntries = Object.entries(event.metadata || {});
    if (metadataEntries.length > MAX_METADATA_ENTRIES) {
      throw new BadRequestException('Interaction metadata has too many entries');
    }
    for (const [key, value] of metadataEntries) {
      this.validateBoundedString(key, 'metadata key', 128);
      this.validateBoundedString(value, `metadata.${key}`, MAX_METADATA_VALUE_LENGTH);
    }
    const counterparty = this.validateProfile(event.counterparty);
    const mappedMembership = event.membershipUpdate
      ? MEMBERSHIP_MAP[event.membershipUpdate]
      : undefined;
    if (event.membershipUpdate && !mappedMembership) {
      throw new BadRequestException('Unsupported audience membership update');
    }
    // UNKNOWN describes absent evidence and must never demote a known follower.
    const membershipUpdate =
      mappedMembership === PrismaAudienceMembership.UNKNOWN
        ? undefined
        : mappedMembership;
    return {
      providerEventKey: event.providerEventKey,
      kind,
      direction,
      eventAt,
      counterparty,
      relatedObjectId: event.relatedObjectId,
      metadata: event.metadata,
      normalizationVersion: event.normalizationVersion,
      membershipUpdate,
      score: getChannelInteractionScore(event.kind, event.direction),
    };
  }

  private getWebhookCapability(providerIdentifier: string) {
    const capability = this.getWebhookCapabilityOrUndefined(providerIdentifier);
    if (!capability) {
      throw new NotFoundException('Channel webhook provider is unavailable');
    }
    return capability;
  }

  private getWebhookCapabilityOrUndefined(providerIdentifier: string) {
    let provider: SocialProvider | undefined;
    try {
      provider = this._integrationManager?.getSocialIntegration(providerIdentifier);
    } catch {
      return undefined;
    }
    return provider?.channelInteractionWebhooks;
  }

  private validateFollower(follower: Follower): AudienceProfile {
    const profile = this.validateProfile({
      externalId: follower.id,
      name: follower.name,
      username: follower.username,
      picture: follower.picture,
      profileUrl: follower.profileUrl,
    });
    return {
      ...profile,
      bio: this.optionalString(follower.bio, 'bio', MAX_PROFILE_TEXT_LENGTH),
      followersCount: this.optionalCount(follower.followersCount, 'followersCount'),
      followingCount: this.optionalCount(follower.followingCount, 'followingCount'),
      followedAt: this.optionalDate(follower.followedAt, 'followedAt'),
      accountCreatedAt: this.optionalDate(
        follower.accountCreatedAt,
        'accountCreatedAt'
      ),
    };
  }

  private validateProfile(profile: {
    externalId: string;
    name?: string;
    username?: string;
    picture?: string;
    profileUrl?: string;
  }): AudienceProfile {
    this.validateBoundedString(profile?.externalId, 'externalId', MAX_ID_LENGTH);
    const picture = this.optionalUrl(profile.picture, 'picture');
    const profileUrl = this.optionalUrl(profile.profileUrl, 'profileUrl');
    return {
      externalId: profile.externalId,
      name: this.optionalString(profile.name, 'name', 512),
      username: this.optionalString(profile.username, 'username', 512),
      picture,
      profileUrl,
    };
  }

  private optionalString(value: string | undefined, field: string, max: number) {
    if (value === undefined) return undefined;
    this.validateBoundedString(value, field, max);
    return value;
  }

  private optionalUrl(value: string | undefined, field: string) {
    if (value === undefined) return undefined;
    this.validateBoundedString(value, field, MAX_PROFILE_TEXT_LENGTH);
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new BadRequestException(`${field} must be an absolute URL`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException(`${field} must use HTTP or HTTPS`);
    }
    return value;
  }

  private optionalCount(value: number | undefined, field: string) {
    if (value === undefined) return undefined;
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new BadRequestException(`${field} must be a non-negative integer`);
    }
    return value;
  }

  private optionalDate(value: string | undefined, field: string) {
    return value === undefined ? undefined : this.parseDate(value, field);
  }

  private parseDate(value: string, field: string) {
    const parsed = new Date(value);
    if (typeof value !== 'string' || !value || Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid timestamp`);
    }
    return parsed;
  }

  private validateGeneration(generation: string) {
    this.validateBoundedString(generation, 'generation', 128);
  }

  private validateBoundedString(
    value: unknown,
    field: string,
    maxLength: number
  ): asserts value is string {
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.length > maxLength
    ) {
      throw new BadRequestException(
        `${field} must be between 1 and ${maxLength} characters`
      );
    }
  }
}
