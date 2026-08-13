import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IntegrationRepository } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import {
  AnalyticsData,
  ChannelNoticeStatus,
  ChannelInteractionKindCoverage,
  ChannelInteractionTrackingFailureCategory,
  FollowerMemberDetail,
  FollowerMemberInteraction,
  FollowerMemberNote,
  FollowerPageTracking,
  Follower,
  FollowerPage,
  FollowerQuery,
  FollowerRelationshipSnapshot,
  FollowerSort,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import {
  AudienceFollowerSortField,
  FOLLOWER_DATABASE_INTERACTIONS_SORT,
  FOLLOWER_DATABASE_NOTES_SORT,
  getAudienceFollowerSortField,
  isPageScopedFollowerSort,
  normalizeFollowerSearch,
  sortFollowers,
} from '@gitroom/nestjs-libraries/integrations/social/follower.sorts';
import {
  ChannelFollowerSyncStatus,
  ChannelInteractionTrackingState,
  ChannelInteractionWindow,
  Integration,
  Organization,
  User,
} from '@prisma/client';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import dayjs from 'dayjs';
import { timer } from '@gitroom/helpers/utils/timer';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { IntegrationTimeDto } from '@gitroom/nestjs-libraries/dtos/integrations/integration.time.dto';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { PlugDto } from '@gitroom/nestjs-libraries/dtos/plugs/plug.dto';
import { difference, uniq } from 'lodash';
import utc from 'dayjs/plugin/utc';
import { AutopostRepository } from '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.repository';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import { TemporalService } from 'nestjs-temporal-core';
import pLimit from 'p-limit';
import { PipelinePlugService } from '@gitroom/nestjs-libraries/database/prisma/pipelines/pipeline.plug.service';
import { ChannelInteractionService } from '@gitroom/nestjs-libraries/database/prisma/channel-interactions/channel-interaction.service';
import {
  AudienceFollowerCursor,
  ChannelInteractionRepository,
  NoteCountFollowerCursor,
  RankedFollowerCursor,
} from '@gitroom/nestjs-libraries/database/prisma/channel-interactions/channel-interaction.repository';

dayjs.extend(utc);

@Injectable()
export class IntegrationService {
  private storage = UploadFactory.createStorage();
  constructor(
    private _integrationRepository: IntegrationRepository,
    private _autopostsRepository: AutopostRepository,
    private _integrationManager: IntegrationManager,
    private _notificationService: NotificationService,
    @Inject(forwardRef(() => RefreshIntegrationService))
    private _refreshIntegrationService: RefreshIntegrationService,
    private _temporalService: TemporalService,
    private _pipelinePlugService: PipelinePlugService,
    private _channelInteractionService: ChannelInteractionService,
    private _channelInteractionRepository: ChannelInteractionRepository
  ) { }

  async changeActiveCron(orgId: string) {
    const data = await this._autopostsRepository.getAutoposts(orgId);

    for (const item of data.filter((f) => f.active)) {
      try {
        await this._temporalService.terminateWorkflow(`autopost-${item.id}`);
      } catch (err) { }
    }

    return true;
  }

  getMentions(platform: string, q: string) {
    return this._integrationRepository.getMentions(platform, q);
  }

  insertMentions(
    platform: string,
    mentions: { name: string; username: string; image: string }[]
  ) {
    return this._integrationRepository.insertMentions(platform, mentions);
  }

  async setTimes(
    orgId: string,
    integrationId: string,
    times: IntegrationTimeDto
  ) {
    return this._integrationRepository.setTimes(orgId, integrationId, times);
  }

  updateProviderSettings(org: string, id: string, additionalSettings: string) {
    return this._integrationRepository.updateProviderSettings(
      org,
      id,
      additionalSettings
    );
  }

  checkPreviousConnections(org: string, id: string) {
    return this._integrationRepository.checkPreviousConnections(org, id);
  }

  async createOrUpdateIntegration(
    additionalSettings:
      | {
        title: string;
        description: string;
        type: 'checkbox' | 'text' | 'textarea';
        value: any;
        regex?: string;
      }[]
      | undefined,
    oneTimeToken: boolean,
    org: string,
    name: string,
    picture: string | undefined,
    type: 'article' | 'social',
    internalId: string,
    provider: string,
    token: string,
    refreshToken = '',
    expiresIn?: number,
    username?: string,
    isBetweenSteps = false,
    refresh?: string,
    timezone?: number,
    customInstanceDetails?: string
  ) {
    const uploadedPicture = picture
      ? picture?.indexOf('imagedelivery.net') > -1
        ? picture
        : await this.storage.uploadSimple(picture).catch((err) => {
          console.log('Failed to upload profile picture:', picture, err);
          return undefined;
        })
      : undefined;

    const integration = await this._integrationRepository.createOrUpdateIntegration(
      additionalSettings,
      oneTimeToken,
      org,
      name,
      uploadedPicture,
      type,
      internalId,
      provider,
      token,
      refreshToken,
      expiresIn,
      username,
      isBetweenSteps,
      refresh,
      timezone,
      customInstanceDetails
    );
    await this.requestInteractionReconciliation(integration);
    return integration;
  }

  updateIntegrationGroup(org: string, id: string, group: string) {
    return this._integrationRepository.updateIntegrationGroup(org, id, group);
  }

  updateOnCustomerName(org: string, id: string, name: string) {
    return this._integrationRepository.updateOnCustomerName(org, id, name);
  }

  getIntegrationsList(org: string) {
    return this._integrationRepository.getIntegrationsList(org);
  }

  async getFollowerChannels(org: Organization) {
    const integrations = await this._integrationRepository.getIntegrationsList(
      org.id
    );
    const limit = pLimit(5);

    const channels = await Promise.all(
      integrations.map((integration) =>
        limit(async () => {
          if (
            integration.disabled ||
            integration.deletedAt ||
            integration.type !== 'social'
          ) {
            return;
          }

          let provider: SocialProvider;
          try {
            provider = this._integrationManager.getSocialIntegration(
              integration.providerIdentifier
            );
          } catch {
            return;
          }

          if (!provider?.followers) {
            return;
          }

          const interactionCapability = provider.channelInteractionWebhooks;
          const cacheKey = `integration:followers:probe:${org.id}:${integration.id}`;
          let eligible: boolean | undefined = interactionCapability ? true : undefined;
          try {
            const cached = await ioRedis.get(cacheKey);
            if (cached === '1') {
              eligible = true;
            } else if (cached === '0') {
              eligible = false;
            }
          } catch { }

          if (eligible === undefined) {
            try {
              const page = await this.getFollowerPage(
                integration,
                provider,
                { limit: 1 }
              );
              eligible = page.items.length > 0;
              try {
                await ioRedis.set(
                  cacheKey,
                  eligible ? '1' : '0',
                  'EX',
                  !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
                    ? 1
                    : 300
                );
              } catch { }
            } catch {
              return;
            }
          }

          if (!eligible) {
            return;
          }

          const tracking = interactionCapability
            ? await this.getInteractionTracking(
              org.id,
              integration.id,
              interactionCapability.getInteractionCoverage()
            )
            : undefined;
          return {
            id: integration.id,
            name: integration.name,
            picture: this.sanitizeHttpUrl(integration.picture),
            display: integration.profile || undefined,
            identifier: integration.providerIdentifier,
            sorts: this.getFollowerSorts(provider),
            ...(tracking ? { tracking } : {}),
          };
        })
      )
    );

    return channels.filter(
      (channel): channel is NonNullable<typeof channel> => !!channel
    );
  }

  async getFollowers(
    org: Organization,
    integrationId: string,
    query: FollowerQuery
  ) {
    const integration = await this._integrationRepository.getIntegrationById(
      org.id,
      integrationId
    );

    if (!integration) {
      throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
    }

    if (
      integration.disabled ||
      integration.deletedAt ||
      integration.type !== 'social'
    ) {
      throw new HttpException('Followers are unavailable', HttpStatus.BAD_REQUEST);
    }

    let provider: SocialProvider;
    try {
      provider = this._integrationManager.getSocialIntegration(
        integration.providerIdentifier
      );
    } catch {
      throw new HttpException('Followers are unavailable', HttpStatus.BAD_REQUEST);
    }

    if (!provider?.followers) {
      throw new HttpException('Followers are unavailable', HttpStatus.BAD_REQUEST);
    }

    const search = normalizeFollowerSearch(query.search);
    const normalizedQuery: FollowerQuery = {
      ...query,
      ...(search ? { search } : { search: undefined }),
    };
    const sort = this.validateFollowerQuery(provider, normalizedQuery);
    if (sort?.scope === 'database') {
      return this.getDatabaseFollowerPage(
        org.id,
        integration,
        provider,
        normalizedQuery,
        sort
      );
    }

    if (search) {
      return this.getAudienceFollowerPage(
        org.id,
        integration,
        provider,
        normalizedQuery,
        sort
      );
    }

    try {
      const page = await this.getFollowerPage(integration, provider, normalizedQuery);
      return this.enrichFollowerPageWithInteractionMetrics(
        org.id,
        integration.id,
        provider,
        page
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Followers are temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async getFollowerMemberDetails(
    org: Organization,
    integrationId: string,
    externalId: string
  ): Promise<FollowerMemberDetail> {
    const provider = await this.getFollowerIntegrationProvider(org, integrationId);
    try {
      const details = await this._channelInteractionService.getFollowerDetails(
        org.id,
        integrationId,
        externalId
      );
      return this.mapFollowerMemberDetails(details, provider);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new HttpException('Follower was not found', HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }

  async createFollowerMemberNote(
    org: Organization,
    user: User,
    integrationId: string,
    externalId: string,
    content: string
  ): Promise<FollowerMemberNote> {
    await this.getFollowerIntegrationProvider(org, integrationId);
    try {
      const note = await this._channelInteractionService.createFollowerNote(
        org.id,
        integrationId,
        externalId,
        user.id,
        content
      );
      return this.mapFollowerMemberNote(note);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new HttpException('Follower was not found', HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }

  async updateFollowerMemberNote(
    org: Organization,
    integrationId: string,
    noteId: string,
    content: string
  ) {
    await this.getFollowerIntegrationProvider(org, integrationId);
    try {
      await this._channelInteractionService.updateFollowerNote(
        org.id,
        integrationId,
        noteId,
        content
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new HttpException('Follower note was not found', HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }

  async deleteFollowerMemberNote(
    org: Organization,
    integrationId: string,
    noteId: string
  ) {
    await this.getFollowerIntegrationProvider(org, integrationId);
    try {
      await this._channelInteractionService.deleteFollowerNote(
        org.id,
        integrationId,
        noteId
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new HttpException('Follower note was not found', HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }

  private async getFollowerIntegrationProvider(
    org: Organization,
    integrationId: string
  ): Promise<SocialProvider> {
    const integration = await this._integrationRepository.getIntegrationById(
      org.id,
      integrationId
    );

    if (!integration) {
      throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
    }

    if (
      integration.disabled ||
      integration.deletedAt ||
      integration.type !== 'social'
    ) {
      throw new HttpException('Followers are unavailable', HttpStatus.BAD_REQUEST);
    }

    let provider: SocialProvider;
    try {
      provider = this._integrationManager.getSocialIntegration(
        integration.providerIdentifier
      );
    } catch {
      throw new HttpException('Followers are unavailable', HttpStatus.BAD_REQUEST);
    }

    if (!provider?.followers) {
      throw new HttpException('Followers are unavailable', HttpStatus.BAD_REQUEST);
    }

    return provider;
  }

  private mapFollowerMemberDetails(
    details: {
      member: {
        externalId: string;
        name: string | null;
        username: string | null;
        picture: string | null;
        profileUrl: string | null;
        bio: string | null;
        followersCount: number | null;
        followingCount: number | null;
        followedAt: Date | null;
        accountCreatedAt: Date | null;
        noteCount: number;
      };
      snapshots: Array<{
        snapshotAt: Date;
        windowStartedAt: Date;
        effortScore: number;
        reciprocationScore: number;
        reciprocity: number | null;
        grade: number | null;
        formulaVersion: number;
      }>;
      notes: Array<{
        id: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        author: {
          id: string;
          name: string | null;
          lastName: string | null;
          email: string;
        };
      }>;
      events: Array<{
        id: string;
        kind: string;
        direction: string;
        eventAt: Date;
        relatedObjectId: string | null;
      }>;
      tracking: {
        followerSync: {
          activeGeneration: string | null;
          status: ChannelFollowerSyncStatus;
          completedAt: Date | null;
        } | null;
        subscriptions: {
          state: ChannelInteractionTrackingState;
          trackingStartedAt?: Date | null;
          failureCategory?: string | null;
          failureReason?: string | null;
        }[];
      };
    },
    provider: SocialProvider
  ): FollowerMemberDetail {
    const history = details.snapshots.map((snapshot) =>
      this.mapFollowerRelationshipSnapshot(snapshot)
    );
    const coverage =
      provider.channelInteractionWebhooks?.getInteractionCoverage() ?? [];
    const tracking =
      provider.channelInteractionWebhooks && coverage.length
        ? this.getInteractionTrackingMetadata(
          details.tracking.followerSync,
          details.tracking.subscriptions,
          coverage,
          undefined,
          { rankingAvailability: false }
        )
        : this.getUnsupportedTrackingMetadata(coverage);

    return {
      follower: this.mapAudienceMemberProfile(details.member),
      notes: details.notes.map((note) => this.mapFollowerMemberNote(note)),
      interactions: details.events.map((event) =>
        this.mapFollowerMemberInteraction(event)
      ),
      relationship: {
        windowDays: 30,
        cadenceDays: 30,
        formulaVersion: 1,
        current: history.length ? history[history.length - 1] : null,
        history,
      },
      tracking,
    };
  }

  private mapAudienceMemberProfile(member: {
    externalId: string;
    name: string | null;
    username: string | null;
    picture: string | null;
    profileUrl: string | null;
    bio: string | null;
    followersCount: number | null;
    followingCount: number | null;
    followedAt: Date | null;
    accountCreatedAt: Date | null;
    noteCount?: number;
  }): Follower {
    return this.sanitizeFollower({
      id: member.externalId,
      name: member.name || member.username || member.externalId,
      ...(member.username ? { username: member.username } : {}),
      ...(member.picture ? { picture: member.picture } : {}),
      ...(member.profileUrl ? { profileUrl: member.profileUrl } : {}),
      ...(member.bio ? { bio: member.bio } : {}),
      ...(member.followersCount != null
        ? { followersCount: member.followersCount }
        : {}),
      ...(member.followingCount != null
        ? { followingCount: member.followingCount }
        : {}),
      ...(member.followedAt
        ? { followedAt: member.followedAt.toISOString() }
        : {}),
      ...(member.accountCreatedAt
        ? { accountCreatedAt: member.accountCreatedAt.toISOString() }
        : {}),
      ...(Number.isSafeInteger(member.noteCount) && member.noteCount! >= 0
        ? { noteCount: member.noteCount }
        : {}),
    });
  }

  private mapFollowerMemberNote(note: {
    id: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    author: {
      id: string;
      name: string | null;
      lastName: string | null;
      email: string;
    };
  }): FollowerMemberNote {
    const name = [note.author.name, note.author.lastName]
      .filter((value): value is string => !!value)
      .join(' ')
      .trim();
    return {
      id: note.id,
      content: note.content,
      author: {
        id: note.author.id,
        name: name || this.displayNameFromEmail(note.author.email) || 'Unknown',
      },
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  private displayNameFromEmail(email: string) {
    const localPart = email.split('@')[0]?.trim();
    if (!localPart) {
      return '';
    }
    const capitalized =
      localPart.charAt(0).toUpperCase() + localPart.slice(1);
    return capitalized.split('.')[0];
  }

  private mapFollowerMemberInteraction(event: {
    id: string;
    kind: string;
    direction: string;
    eventAt: Date;
    relatedObjectId: string | null;
  }): FollowerMemberInteraction {
    return {
      id: event.id,
      kind: event.kind.toLowerCase() as FollowerMemberInteraction['kind'],
      direction: event.direction.toLowerCase() as FollowerMemberInteraction['direction'],
      timestamp: event.eventAt.toISOString(),
      ...(event.relatedObjectId ? { relatedObjectId: event.relatedObjectId } : {}),
    };
  }

  private mapFollowerRelationshipSnapshot(snapshot: {
    snapshotAt: Date;
    windowStartedAt: Date;
    effortScore: number;
    reciprocationScore: number;
    reciprocity: number | null;
    grade: number | null;
    formulaVersion: number;
  }): FollowerRelationshipSnapshot {
    return {
      snapshotAt: snapshot.snapshotAt.toISOString(),
      windowStartedAt: snapshot.windowStartedAt.toISOString(),
      effortScore: snapshot.effortScore,
      reciprocationScore: snapshot.reciprocationScore,
      reciprocity: snapshot.reciprocity,
      grade: snapshot.grade,
      formulaVersion: snapshot.formulaVersion,
    };
  }

  private validateFollowerQuery(
    provider: SocialProvider,
    query: FollowerQuery
  ): FollowerSort | undefined {
    if (query.cursor && this.isHttpUrl(query.cursor)) {
      throw new HttpException('Invalid follower cursor', HttpStatus.BAD_REQUEST);
    }

    const search = normalizeFollowerSearch(query.search);
    const isAudienceCursor = !!query.cursor?.startsWith('follower-audience:v1:');
    const isRankCursor = !!query.cursor?.startsWith('follower-rank:v1:');
    const isNotesCursor = !!query.cursor?.startsWith('follower-notes:v1:');

    if (isAudienceCursor && !search) {
      throw new HttpException('Invalid follower cursor', HttpStatus.BAD_REQUEST);
    }

    if (!query.sort && !query.direction) {
      if (isRankCursor || isNotesCursor) {
        throw new HttpException('Invalid follower cursor', HttpStatus.BAD_REQUEST);
      }
      return undefined;
    }

    const sort = this.getFollowerSorts(provider).find(
      (candidate) => candidate.key === query.sort
    );
    if (!sort || (query.direction && !sort.directions.includes(query.direction))) {
      throw new HttpException('Unsupported follower sort', HttpStatus.BAD_REQUEST);
    }
    if (sort.scope === 'database') {
      if (isAudienceCursor) {
        throw new HttpException('Invalid follower cursor', HttpStatus.BAD_REQUEST);
      }
      if (sort.requiresWindow && !query.window) {
        throw new HttpException(
          'A time window is required for this follower sort',
          HttpStatus.BAD_REQUEST
        );
      }
      return sort;
    }
    if (isRankCursor || isNotesCursor) {
      throw new HttpException('Invalid follower cursor', HttpStatus.BAD_REQUEST);
    }
    return sort;
  }

  private async getDatabaseFollowerPage(
    organizationId: string,
    integration: Integration,
    provider: SocialProvider,
    query: FollowerQuery,
    sort: FollowerSort
  ): Promise<FollowerPage> {
    if (sort.key === FOLLOWER_DATABASE_NOTES_SORT.key) {
      return this.getNoteCountFollowerPage(organizationId, integration, query, sort);
    }

    const direction = query.direction ?? sort.defaultDirection;
    const window = query.window!;
    const cursor = query.cursor
      ? this.decodeRankedFollowerCursor(
        query.cursor,
        organizationId,
        integration.id,
        window,
        direction
      )
      : undefined;
    const ranked = await this._channelInteractionRepository.getRankedFollowers({
      organizationId,
      integrationId: integration.id,
      window: this.toPrismaInteractionWindow(window),
      direction,
      limit: query.limit,
      ...(cursor ? { cursor } : {}),
      ...(query.search ? { search: query.search } : {}),
    });
    if (cursor && ranked.rollup?.activeGeneration !== cursor.generation) {
      throw new HttpException('Invalid follower cursor', HttpStatus.BAD_REQUEST);
    }
    const tracking = this.getInteractionTrackingMetadata(
      ranked.followerSync,
      ranked.subscriptions,
      provider.channelInteractionWebhooks!.getInteractionCoverage(),
      ranked.rollup?.computedAt,
      { rankingAvailability: true }
    );
    if (
      !ranked.rollup ||
      !ranked.followerSync?.activeGeneration ||
      !ranked.followerSync.completedAt
    ) {
      return { items: [], hasMore: false, window, tracking };
    }

    const noteCounts =
      await this._channelInteractionRepository.getFollowerNoteCounts(
        organizationId,
        integration.id,
        ranked.items.map((row) => row.counterpartyExternalId)
      );
    const items = ranked.items.map((row) =>
      this.sanitizeFollower({
        id: row.counterpartyExternalId,
        name: row.audienceMember.name || row.audienceMember.username || row.counterpartyExternalId,
        ...(row.audienceMember.username ? { username: row.audienceMember.username } : {}),
        ...(row.audienceMember.picture ? { picture: row.audienceMember.picture } : {}),
        ...(row.audienceMember.profileUrl ? { profileUrl: row.audienceMember.profileUrl } : {}),
        ...(row.audienceMember.bio ? { bio: row.audienceMember.bio } : {}),
        ...(row.audienceMember.followersCount !== null ? { followersCount: row.audienceMember.followersCount } : {}),
        ...(row.audienceMember.followingCount !== null ? { followingCount: row.audienceMember.followingCount } : {}),
        ...(row.audienceMember.followedAt ? { followedAt: row.audienceMember.followedAt.toISOString() } : {}),
        ...(row.audienceMember.accountCreatedAt ? { accountCreatedAt: row.audienceMember.accountCreatedAt.toISOString() } : {}),
        interactionCount: row.interactionCount,
        interactionScore: row.interactionScore,
        ...(row.lastInteractionAt ? { lastInteractionAt: row.lastInteractionAt.toISOString() } : {}),
        noteCount: noteCounts.get(row.counterpartyExternalId) ?? 0,
      })
    );
    const last = items.at(-1);
    return {
      items,
      hasMore: ranked.hasMore,
      ...(ranked.hasMore && last
        ? {
          nextCursor: this.encodeRankedFollowerCursor({
            organizationId,
            integrationId: integration.id,
            window,
            direction,
            generation: ranked.rollup.activeGeneration,
            interactionCount: last.interactionCount!,
            interactionScore: last.interactionScore!,
            lastInteractionAt: last.lastInteractionAt || null,
            externalId: last.id,
          }),
        }
        : {}),
      window,
      tracking,
    };
  }

  private async getAudienceFollowerPage(
    organizationId: string,
    integration: Integration,
    provider: SocialProvider,
    query: FollowerQuery,
    sort?: FollowerSort
  ): Promise<FollowerPage> {
    const search = query.search!;
    const direction = query.direction ?? sort?.defaultDirection ?? 'desc';
    const sortKey = sort?.key ?? 'recent';
    const sortField = getAudienceFollowerSortField(sortKey);
    const cursor = query.cursor
      ? this.decodeAudienceFollowerCursor(
        query.cursor,
        organizationId,
        integration.id,
        sortKey,
        direction,
        search,
        sortField
      )
      : undefined;
    const ranked = await this._channelInteractionRepository.getAudienceFollowers({
      organizationId,
      integrationId: integration.id,
      search,
      sortField,
      direction,
      limit: query.limit,
      ...(cursor ? { cursor } : {}),
    });
    const items = ranked.items.map((row) =>
      this.sanitizeFollower({
        id: row.externalId,
        name: row.name || row.username || row.externalId,
        ...(row.username ? { username: row.username } : {}),
        ...(row.picture ? { picture: row.picture } : {}),
        ...(row.profileUrl ? { profileUrl: row.profileUrl } : {}),
        ...(row.bio ? { bio: row.bio } : {}),
        ...(row.followersCount !== null ? { followersCount: row.followersCount } : {}),
        ...(row.followingCount !== null ? { followingCount: row.followingCount } : {}),
        ...(row.followedAt ? { followedAt: row.followedAt.toISOString() } : {}),
        ...(row.accountCreatedAt
          ? { accountCreatedAt: row.accountCreatedAt.toISOString() }
          : {}),
        noteCount: row.noteCount,
      })
    );
    const last = ranked.items.at(-1);
    const page: FollowerPage = {
      items,
      hasMore: ranked.hasMore,
      ...(ranked.hasMore && last
        ? {
          nextCursor: this.encodeAudienceFollowerCursor({
            organizationId,
            integrationId: integration.id,
            sort: sortKey,
            direction,
            search,
            sortField,
            sortValue: this.audienceCursorSortValue(last, sortField),
            externalId: last.externalId,
          }),
        }
        : {}),
    };

    return this.enrichFollowerPageWithInteractionMetrics(
      organizationId,
      integration.id,
      provider,
      page
    );
  }

  private async getNoteCountFollowerPage(
    organizationId: string,
    integration: Integration,
    query: FollowerQuery,
    sort: FollowerSort
  ): Promise<FollowerPage> {
    const direction = query.direction ?? sort.defaultDirection;
    const cursor = query.cursor
      ? this.decodeNoteCountFollowerCursor(
        query.cursor,
        organizationId,
        integration.id,
        direction
      )
      : undefined;
    const ranked = await this._channelInteractionRepository.getFollowersByNoteCount({
      organizationId,
      integrationId: integration.id,
      direction,
      limit: query.limit,
      ...(cursor ? { cursor } : {}),
      ...(query.search ? { search: query.search } : {}),
    });

    const items = ranked.items.map((row) =>
      this.sanitizeFollower({
        id: row.externalId,
        name: row.name || row.username || row.externalId,
        ...(row.username ? { username: row.username } : {}),
        ...(row.picture ? { picture: row.picture } : {}),
        ...(row.profileUrl ? { profileUrl: row.profileUrl } : {}),
        ...(row.bio ? { bio: row.bio } : {}),
        ...(row.followersCount !== null ? { followersCount: row.followersCount } : {}),
        ...(row.followingCount !== null ? { followingCount: row.followingCount } : {}),
        ...(row.followedAt ? { followedAt: row.followedAt.toISOString() } : {}),
        ...(row.accountCreatedAt
          ? { accountCreatedAt: row.accountCreatedAt.toISOString() }
          : {}),
        noteCount: row.noteCount,
      })
    );
    const last = items.at(-1);
    return {
      items,
      hasMore: ranked.hasMore,
      ...(ranked.hasMore && last
        ? {
          nextCursor: this.encodeNoteCountFollowerCursor({
            organizationId,
            integrationId: integration.id,
            direction,
            noteCount: last.noteCount!,
            externalId: last.id,
          }),
        }
        : {}),
    };
  }

  private async getInteractionTracking(
    organizationId: string,
    integrationId: string,
    coverage: ChannelInteractionKindCoverage[]
  ) {
    const tracking = await this._channelInteractionRepository.getInteractionTracking(
      organizationId,
      integrationId
    );
    return this.getInteractionTrackingMetadata(
      tracking.followerSync,
      tracking.subscriptions,
      coverage,
      undefined,
      { rankingAvailability: false }
    );
  }

  private getInteractionTrackingMetadata(
    followerSync: {
      activeGeneration: string | null;
      status: ChannelFollowerSyncStatus;
      completedAt: Date | null;
    } | null | undefined,
    subscriptions: {
      state: ChannelInteractionTrackingState;
      trackingStartedAt?: Date | null;
      failureCategory?: string | null;
      failureReason?: string | null;
    }[],
    coverage: ChannelInteractionKindCoverage[],
    computedAt?: Date,
    options?: { rankingAvailability?: boolean }
  ): FollowerPageTracking {
    const states = subscriptions.map((subscription) => subscription.state);
    const failedSubscription = subscriptions.find(
      (subscription) => subscription.state === ChannelInteractionTrackingState.ERROR
    );
    const state = states.includes(ChannelInteractionTrackingState.ERROR)
      ? 'error'
      : states.includes(ChannelInteractionTrackingState.PROVISIONING) ||
        !states.length
        ? 'provisioning'
        : states.includes(ChannelInteractionTrackingState.UNCONFIGURED)
          ? 'unconfigured'
          : states.includes(ChannelInteractionTrackingState.PARTIAL) ||
            this.hasLimitedInteractionCoverage(coverage)
            ? 'partial'
            : 'active';
    const availability = options?.rankingAvailability
      ? followerSync?.activeGeneration && followerSync.completedAt && computedAt
        ? 'ready'
        : state === 'error' || state === 'unconfigured'
          ? 'unavailable'
          : 'provisioning'
      : state === 'error' || state === 'unconfigured'
        ? 'unavailable'
        : state === 'provisioning'
          ? 'provisioning'
          : undefined;
    const trackingStartedAt = subscriptions
      .map((subscription) => subscription.trackingStartedAt)
      .filter((startedAt): startedAt is Date => !!startedAt)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const failureCategory = this.trackingFailureCategory(
      failedSubscription?.failureCategory
    );
    return {
      state,
      ...(availability ? { availability } : {}),
      noBackfill: true,
      ...(trackingStartedAt
        ? { trackingStartedAt: trackingStartedAt.toISOString() }
        : {}),
      ...(followerSync?.completedAt
        ? { followerSnapshotAt: followerSync.completedAt.toISOString() }
        : {}),
      ...(computedAt ? { computedAt: computedAt.toISOString() } : {}),
      ...(failureCategory ? { failureCategory } : {}),
      ...(failedSubscription?.failureReason
        ? { reason: failedSubscription.failureReason.slice(0, 160) }
        : {}),
      coverage,
    };
  }

  private getUnsupportedTrackingMetadata(
    coverage: ChannelInteractionKindCoverage[] = []
  ): FollowerPageTracking {
    return {
      state: 'unsupported',
      availability: 'unavailable',
      noBackfill: true,
      coverage,
    };
  }

  private hasLimitedInteractionCoverage(
    coverage: ChannelInteractionKindCoverage[]
  ) {
    return coverage.some(
      (item) =>
        item.inbound === 'partial' ||
        item.outbound === 'partial' ||
        item.inbound === 'unsupported' ||
        item.outbound === 'unsupported'
    );
  }

  private trackingFailureCategory(
    value: string | null | undefined
  ): ChannelInteractionTrackingFailureCategory | undefined {
    return [
      'configuration',
      'authentication',
      'authorization',
      'entitlement',
      'quota',
      'transient',
      'unknown',
    ].includes(value || '')
      ? value as ChannelInteractionTrackingFailureCategory
      : undefined;
  }

  private toPrismaInteractionWindow(window: NonNullable<FollowerQuery['window']>) {
    return {
      week: ChannelInteractionWindow.WEEK,
      month: ChannelInteractionWindow.MONTH,
      '90_day': ChannelInteractionWindow.NINETY_DAY,
      year: ChannelInteractionWindow.YEAR,
    }[window];
  }

  private encodeRankedFollowerCursor(cursor: {
    organizationId: string;
    integrationId: string;
    window: NonNullable<FollowerQuery['window']>;
    direction: 'asc' | 'desc';
    generation: string;
  } & RankedFollowerCursor) {
    return `follower-rank:v1:${Buffer.from(
      JSON.stringify({ version: 1, ...cursor })
    ).toString('base64url')}`;
  }

  private decodeRankedFollowerCursor(
    value: string,
    organizationId: string,
    integrationId: string,
    window: NonNullable<FollowerQuery['window']>,
    direction: 'asc' | 'desc'
  ): RankedFollowerCursor & { generation: string } {
    try {
      if (!value.startsWith('follower-rank:v1:')) throw new Error();
      const cursor = JSON.parse(
        Buffer.from(value.slice('follower-rank:v1:'.length), 'base64url').toString(
          'utf8'
        )
      );
      if (
        cursor?.version !== 1 ||
        cursor.organizationId !== organizationId ||
        cursor.integrationId !== integrationId ||
        cursor.window !== window ||
        cursor.direction !== direction ||
        typeof cursor.generation !== 'string' ||
        !Number.isSafeInteger(cursor.interactionCount) ||
        !Number.isSafeInteger(cursor.interactionScore) ||
        typeof cursor.externalId !== 'string' ||
        (cursor.lastInteractionAt !== null &&
          (typeof cursor.lastInteractionAt !== 'string' ||
            Number.isNaN(new Date(cursor.lastInteractionAt).getTime())))
      ) {
        throw new Error();
      }
      return cursor;
    } catch {
      throw new HttpException('Invalid follower cursor', HttpStatus.BAD_REQUEST);
    }
  }

  private encodeNoteCountFollowerCursor(cursor: {
    organizationId: string;
    integrationId: string;
    direction: 'asc' | 'desc';
  } & NoteCountFollowerCursor) {
    return `follower-notes:v1:${Buffer.from(
      JSON.stringify({ version: 1, ...cursor })
    ).toString('base64url')}`;
  }

  private decodeNoteCountFollowerCursor(
    value: string,
    organizationId: string,
    integrationId: string,
    direction: 'asc' | 'desc'
  ): NoteCountFollowerCursor {
    try {
      if (!value.startsWith('follower-notes:v1:')) throw new Error();
      const cursor = JSON.parse(
        Buffer.from(
          value.slice('follower-notes:v1:'.length),
          'base64url'
        ).toString('utf8')
      );
      if (
        cursor?.version !== 1 ||
        cursor.organizationId !== organizationId ||
        cursor.integrationId !== integrationId ||
        cursor.direction !== direction ||
        !Number.isSafeInteger(cursor.noteCount) ||
        cursor.noteCount < 0 ||
        typeof cursor.externalId !== 'string'
      ) {
        throw new Error();
      }
      return {
        noteCount: cursor.noteCount,
        externalId: cursor.externalId,
      };
    } catch {
      throw new HttpException('Invalid follower cursor', HttpStatus.BAD_REQUEST);
    }
  }

  private encodeAudienceFollowerCursor(cursor: {
    organizationId: string;
    integrationId: string;
    sort: string;
    direction: 'asc' | 'desc';
    search: string;
    sortField: AudienceFollowerSortField;
  } & AudienceFollowerCursor) {
    return `follower-audience:v1:${Buffer.from(
      JSON.stringify({ version: 1, ...cursor })
    ).toString('base64url')}`;
  }

  private decodeAudienceFollowerCursor(
    value: string,
    organizationId: string,
    integrationId: string,
    sort: string,
    direction: 'asc' | 'desc',
    search: string,
    sortField: AudienceFollowerSortField
  ): AudienceFollowerCursor {
    try {
      if (!value.startsWith('follower-audience:v1:')) throw new Error();
      const cursor = JSON.parse(
        Buffer.from(
          value.slice('follower-audience:v1:'.length),
          'base64url'
        ).toString('utf8')
      );
      if (
        cursor?.version !== 1 ||
        cursor.organizationId !== organizationId ||
        cursor.integrationId !== integrationId ||
        cursor.sort !== sort ||
        cursor.direction !== direction ||
        cursor.search !== search ||
        cursor.sortField !== sortField ||
        typeof cursor.externalId !== 'string' ||
        !this.isAudienceCursorSortValue(cursor.sortField, cursor.sortValue)
      ) {
        throw new Error();
      }
      return {
        sortField: cursor.sortField,
        sortValue: cursor.sortValue,
        externalId: cursor.externalId,
      };
    } catch {
      throw new HttpException('Invalid follower cursor', HttpStatus.BAD_REQUEST);
    }
  }

  private isAudienceCursorSortValue(
    field: AudienceFollowerSortField,
    value: unknown
  ): value is string | number | null {
    if (value === null) {
      return true;
    }
    if (field === 'followersCount' || field === 'followingCount') {
      return typeof value === 'number' && Number.isSafeInteger(value);
    }
    if (field === 'followedAt' || field === 'accountCreatedAt') {
      return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
    }
    return typeof value === 'string';
  }

  private audienceCursorSortValue(
    row: {
      name: string | null;
      followersCount: number | null;
      followingCount: number | null;
      followedAt: Date | null;
      accountCreatedAt: Date | null;
    },
    sortField: AudienceFollowerSortField
  ): string | number | null {
    const value = row[sortField];
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return null;
  }

  private async enrichFollowerPageWithInteractionMetrics(
    organizationId: string,
    integrationId: string,
    provider: SocialProvider,
    page: FollowerPage
  ): Promise<FollowerPage> {
    if (!provider.channelInteractionWebhooks || !page.items.length) {
      return page;
    }

    const externalIds = page.items.map((item) => item.id);
    const [metrics, noteCounts] = await Promise.all([
      this._channelInteractionRepository.getFollowerInteractionMetrics(
        organizationId,
        integrationId,
        externalIds
      ),
      this._channelInteractionRepository.getFollowerNoteCounts(
        organizationId,
        integrationId,
        externalIds
      ),
    ]);

    return {
      ...page,
      items: page.items.map((item) => {
        const metric = metrics.get(item.id);
        return this.sanitizeFollower({
          ...item,
          interactionCount: metric?.interactionCount ?? 0,
          noteCount: noteCounts.get(item.id) ?? 0,
          ...(metric
            ? {
              interactionScore: metric.interactionScore,
              ...(metric.lastInteractionAt
                ? {
                  lastInteractionAt:
                    metric.lastInteractionAt.toISOString(),
                }
                : {}),
            }
            : {}),
        });
      }),
    };
  }

  private async getFollowerPage(
    integration: Integration,
    provider: SocialProvider,
    query: FollowerQuery,
    forceRefresh = false
  ): Promise<FollowerPage> {
    const liveIntegration = { ...integration };
    if (
      forceRefresh ||
      (!!liveIntegration.tokenExpiration &&
        dayjs(liveIntegration.tokenExpiration).isBefore(dayjs()))
    ) {
      const data = await this._refreshIntegrationService.refresh(liveIntegration);
      if (!data || !data.accessToken) {
        throw new HttpException(
          'Followers are temporarily unavailable',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      liveIntegration.token = data.accessToken;
      if (provider.refreshWait) {
        await timer(10000);
      }
    }

    try {
      const pageScoped = isPageScopedFollowerSort(
        this.getFollowerSorts(provider),
        query.sort
      );
      const providerQuery: FollowerQuery = pageScoped
        ? { ...query, sort: undefined, direction: undefined, search: undefined }
        : { ...query, search: undefined };
      const page = await provider.followers!(
        liveIntegration,
        liveIntegration.token,
        providerQuery
      );
      const sanitized = this.sanitizeFollowerPage(page);

      if (!pageScoped || !query.sort) {
        return sanitized;
      }

      const sort = this.getFollowerSorts(provider).find(
        (candidate) => candidate.key === query.sort
      );
      const direction = query.direction ?? sort?.defaultDirection ?? 'desc';

      return {
        ...sanitized,
        items: sortFollowers(sanitized.items, query.sort, direction),
      };
    } catch (error) {
      if (error instanceof RefreshToken && !forceRefresh) {
        return this.getFollowerPage(integration, provider, query, true);
      }
      throw error;
    }
  }

  private sanitizeFollowerPage(page: FollowerPage): FollowerPage {
    return {
      items: Array.isArray(page?.items)
        ? page.items.map((follower) => this.sanitizeFollower(follower))
        : [],
      ...(Number.isSafeInteger(page?.total) && page.total >= 0
        ? { total: page.total }
        : {}),
      ...(typeof page?.nextCursor === 'string' &&
        !this.isHttpUrl(page.nextCursor)
        ? { nextCursor: page.nextCursor }
        : {}),
      ...(typeof page?.previousCursor === 'string' &&
        !this.isHttpUrl(page.previousCursor)
        ? { previousCursor: page.previousCursor }
        : {}),
      hasMore: page?.hasMore === true,
    };
  }

  private sanitizeFollower(follower: Follower): Follower {
    return {
      id: String(follower.id),
      name: String(follower.name),
      ...(typeof follower.username === 'string'
        ? { username: follower.username }
        : {}),
      ...(this.sanitizeHttpUrl(follower.picture)
        ? { picture: this.sanitizeHttpUrl(follower.picture) }
        : {}),
      ...(this.sanitizeHttpUrl(follower.profileUrl)
        ? { profileUrl: this.sanitizeHttpUrl(follower.profileUrl) }
        : {}),
      ...(typeof follower.bio === 'string' ? { bio: follower.bio } : {}),
      ...(Number.isFinite(follower.followersCount)
        ? { followersCount: follower.followersCount }
        : {}),
      ...(Number.isFinite(follower.followingCount)
        ? { followingCount: follower.followingCount }
        : {}),
      ...(Number.isFinite(follower.influenceScore)
        ? { influenceScore: follower.influenceScore }
        : {}),
      ...(typeof follower.followedAt === 'string'
        ? { followedAt: follower.followedAt }
        : {}),
      ...(typeof follower.accountCreatedAt === 'string'
        ? { accountCreatedAt: follower.accountCreatedAt }
        : {}),
      ...(Number.isSafeInteger(follower.interactionCount) &&
        follower.interactionCount >= 0
        ? { interactionCount: follower.interactionCount }
        : {}),
      ...(Number.isSafeInteger(follower.interactionScore) &&
        follower.interactionScore >= 0
        ? { interactionScore: follower.interactionScore }
        : {}),
      ...(typeof follower.lastInteractionAt === 'string'
        ? { lastInteractionAt: follower.lastInteractionAt }
        : {}),
      ...(Number.isSafeInteger(follower.noteCount) && follower.noteCount >= 0
        ? { noteCount: follower.noteCount }
        : {}),
    };
  }

  private getFollowerSorts(provider: SocialProvider) {
    const sorts = [...(provider.followerSorts || [])];
    if (!provider.channelInteractionWebhooks) {
      return sorts;
    }
    if (
      !sorts.some(
        (sort) => sort.key === FOLLOWER_DATABASE_INTERACTIONS_SORT.key
      )
    ) {
      sorts.push(FOLLOWER_DATABASE_INTERACTIONS_SORT);
    }
    if (!sorts.some((sort) => sort.key === FOLLOWER_DATABASE_NOTES_SORT.key)) {
      sorts.push(FOLLOWER_DATABASE_NOTES_SORT);
    }
    return sorts;
  }

  private sanitizeHttpUrl(url: string | null | undefined) {
    return typeof url === 'string' && this.isHttpUrl(url) ? url : undefined;
  }

  private isHttpUrl(value: string) {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  getIntegrationForOrder(id: string, order: string, user: string, org: string) {
    return this._integrationRepository.getIntegrationForOrder(
      id,
      order,
      user,
      org
    );
  }

  updateNameAndUrl(id: string, name: string, url: string) {
    return this._integrationRepository.updateNameAndUrl(id, name, url);
  }

  getIntegrationById(org: string, id: string) {
    return this._integrationRepository.getIntegrationById(org, id);
  }

  async refreshToken(provider: SocialProvider, refresh: string) {
    try {
      const { refreshToken, accessToken, expiresIn } =
        await provider.refreshToken(refresh);

      if (!refreshToken || !accessToken || !expiresIn) {
        return false;
      }

      return { refreshToken, accessToken, expiresIn };
    } catch (e) {
      return false;
    }
  }

  async disconnectChannel(orgId: string, integration: Integration) {
    await this._integrationRepository.disconnectChannel(orgId, integration.id);
    await this.informAboutRefreshError(orgId, integration);
  }

  async informAboutRefreshError(
    orgId: string,
    integration: Integration,
    err = ''
  ) {
    await this._notificationService.inAppNotification(
      orgId,
      `Could not refresh your ${integration.providerIdentifier} channel ${err}`,
      `Could not refresh your ${integration.providerIdentifier} channel ${err}. Please go back to the system and connect it again ${process.env.FRONTEND_URL}/calendar`,
      true,
      false,
      'info'
    );
  }

  async refreshNeeded(org: string, id: string) {
    return this._integrationRepository.refreshNeeded(org, id);
  }

  async setBetweenRefreshSteps(id: string) {
    return this._integrationRepository.setBetweenRefreshSteps(id);
  }

  async refreshTokens() {
    const integrations = await this._integrationRepository.needsToBeRefreshed();
    for (const integration of integrations) {
      const provider = this._integrationManager.getSocialIntegration(
        integration.providerIdentifier
      );

      const data = await this.refreshToken(provider, integration.refreshToken!);

      if (!data) {
        await this.informAboutRefreshError(
          integration.organizationId,
          integration
        );
        await this._integrationRepository.refreshNeeded(
          integration.organizationId,
          integration.id
        );
        return;
      }

      const { refreshToken, accessToken, expiresIn } = data;

      await this.createOrUpdateIntegration(
        undefined,
        !!provider.oneTimeToken,
        integration.organizationId,
        integration.name,
        undefined,
        'social',
        integration.internalId,
        integration.providerIdentifier,
        accessToken,
        refreshToken,
        expiresIn
      );
    }
  }

  async disableChannel(org: string, id: string) {
    const integration = await this._integrationRepository.getIntegrationById(org, id);
    await this._integrationRepository.disableChannel(org, id);
    if (integration) {
      await this.requestInteractionRemoval(integration);
    }
  }

  async enableChannel(org: string, totalChannels: number, id: string) {
    const integrations = (
      await this._integrationRepository.getIntegrationsList(org)
    ).filter((f) => !f.disabled);
    if (
      !!process.env.STRIPE_PUBLISHABLE_KEY &&
      integrations.length >= totalChannels
    ) {
      throw new Error('You have reached the maximum number of channels');
    }

    await this._integrationRepository.enableChannel(org, id);
    const integration = await this._integrationRepository.getIntegrationById(org, id);
    if (integration) {
      await this.requestInteractionReconciliation(integration);
    }
  }

  async getPostsForChannel(org: string, id: string) {
    return this._integrationRepository.getPostsForChannel(org, id);
  }

  async deleteChannel(org: string, id: string) {
    const integration = await this._integrationRepository.getIntegrationById(org, id);
    await this._integrationRepository.deleteChannel(org, id);
    if (integration) {
      await this.requestInteractionRemoval(integration);
    }
  }

  async disableIntegrations(org: string, totalChannels: number) {
    return this._integrationRepository.disableIntegrations(org, totalChannels);
  }

  async checkForDeletedOnceAndUpdate(org: string, page: string) {
    return this._integrationRepository.checkForDeletedOnceAndUpdate(org, page);
  }

  async saveProviderPage(org: string, id: string, data: any) {
    const getIntegration = await this._integrationRepository.getIntegrationById(
      org,
      id
    );
    if (!getIntegration) {
      throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
    }
    if (!getIntegration.inBetweenSteps) {
      throw new HttpException('Invalid request', HttpStatus.BAD_REQUEST);
    }

    const provider = this._integrationManager.getSocialIntegration(
      getIntegration.providerIdentifier
    );

    if (!provider.fetchPageInformation) {
      throw new HttpException(
        'Provider does not support page selection',
        HttpStatus.BAD_REQUEST
      );
    }

    const getIntegrationInformation = await provider.fetchPageInformation(
      getIntegration.token,
      data
    );

    await this.checkForDeletedOnceAndUpdate(
      org,
      String(getIntegrationInformation.id)
    );
    await this._integrationRepository.updateIntegration(id, {
      picture: getIntegrationInformation.picture,
      internalId: String(getIntegrationInformation.id),
      organizationId: org,
      name: getIntegrationInformation.name,
      inBetweenSteps: false,
      token: getIntegrationInformation.access_token,
      profile: getIntegrationInformation.username,
    });

    return { success: true };
  }

  async checkAnalytics(
    org: Organization,
    integration: string,
    date: string,
    forceRefresh = false
  ): Promise<AnalyticsData[]> {
    const { analytics } = await this.checkAnalyticsResult(
      org,
      integration,
      date,
      forceRefresh
    );

    return analytics;
  }

  private async checkAnalyticsResult(
    org: Organization,
    integration: string,
    date: string,
    forceRefresh = false
  ): Promise<{ analytics: AnalyticsData[]; failed: boolean }> {
    const getIntegration = await this.getIntegrationById(org.id, integration);

    if (!getIntegration) {
      throw new Error('Invalid integration');
    }

    if (getIntegration.type !== 'social') {
      return { analytics: [], failed: false };
    }

    const integrationProvider = this._integrationManager.getSocialIntegration(
      getIntegration.providerIdentifier
    );

    if (
      dayjs(getIntegration?.tokenExpiration).isBefore(dayjs()) ||
      forceRefresh
    ) {
      const data = await this._refreshIntegrationService.refresh(
        getIntegration
      );
      if (!data) {
        return { analytics: [], failed: true };
      }

      const { accessToken } = data;

      if (accessToken) {
        getIntegration.token = accessToken;

        if (integrationProvider.refreshWait) {
          await timer(10000);
        }
      } else {
        await this.disconnectChannel(org.id, getIntegration);
        return { analytics: [], failed: true };
      }
    }

    const getIntegrationData = await ioRedis.get(
      `integration:${org.id}:${integration}:${date}`
    );
    if (getIntegrationData) {
      return { analytics: JSON.parse(getIntegrationData), failed: false };
    }

    if (integrationProvider.analytics) {
      try {
        const loadAnalytics = await integrationProvider.analytics(
          getIntegration.internalId,
          getIntegration.token,
          +date
        );
        await ioRedis.set(
          `integration:${org.id}:${integration}:${date}`,
          JSON.stringify(loadAnalytics),
          'EX',
          !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
            ? 1
            : 3600
        );
        return { analytics: loadAnalytics, failed: false };
      } catch (e) {
        if (e instanceof RefreshToken) {
          return this.checkAnalyticsResult(org, integration, date, true);
        }

        return { analytics: [], failed: true };
      }
    }

    return { analytics: [], failed: false };
  }

  async getDashboardAnalytics(org: Organization, date: 7 | 30 | 90) {
    const integrations = await this._integrationRepository.getIntegrationsList(
      org.id
    );
    const limit = pLimit(5);

    return Promise.all(
      integrations.map((integration) =>
        limit(async () => {
          const channel = {
            id: integration.id,
            name: integration.name,
            picture: integration.picture,
            display: integration.profile,
            identifier: integration.providerIdentifier,
          };

          if (integration.disabled) {
            return { ...channel, state: 'disabled' as const, analytics: [] };
          }

          if (integration.type !== 'social') {
            return { ...channel, state: 'unsupported' as const, analytics: [] };
          }

          let provider: SocialProvider;
          try {
            provider = this._integrationManager.getSocialIntegration(
              integration.providerIdentifier
            );
          } catch {
            return {
              ...channel,
              state: 'unsupported' as const,
              analytics: [],
            };
          }

          if (!provider?.analytics) {
            return { ...channel, state: 'unsupported' as const, analytics: [] };
          }

          try {
            const analytics = await this.checkAnalyticsResult(
              org,
              integration.id,
              String(date)
            );

            return {
              ...channel,
              state: analytics.failed ? ('unavailable' as const) : ('ok' as const),
              analytics: analytics.failed ? [] : analytics.analytics,
            };
          } catch {
            return { ...channel, state: 'unavailable' as const, analytics: [] };
          }
        })
      )
    );
  }

  async getChannelNoticeStatus(org: Organization, user: User) {
    const integrations = await this._integrationRepository.getIntegrationsList(
      org.id
    );
    const readStates =
      await this._integrationRepository.getNoticeReadsForUser(
        user.id,
        integrations.map((integration) => integration.id)
      );
    const lastReadByIntegration = new Map(
      readStates.map((read) => [read.integrationId, read.lastReadAt])
    );
    const limit = pLimit(5);
    const defaultSince = dayjs().subtract(30, 'day').toDate();

    const statuses = await Promise.all(
      integrations.map((integration) =>
        limit(async () => {
          const channel = {
            id: integration.id,
            state: 'unsupported' as ChannelNoticeStatus['state'] | 'disabled',
            unreadCount: 0,
            categories: undefined as
              | Partial<Record<'mention' | 'reply' | 'like' | 'repost' | 'follow', number>>
              | undefined,
          };

          if (integration.disabled) {
            return { ...channel, state: 'disabled' as const };
          }

          if (integration.type !== 'social') {
            return channel;
          }

          let provider: SocialProvider;
          try {
            provider = this._integrationManager.getSocialIntegration(
              integration.providerIdentifier
            );
          } catch {
            return channel;
          }

          if (!provider?.channelNotices) {
            return channel;
          }

          try {
            const status = await this.checkChannelNoticeResult(
              org,
              integration,
              provider,
              lastReadByIntegration.get(integration.id) || defaultSince
            );

            return {
              id: integration.id,
              state: status.state,
              unreadCount: status.state === 'ok' ? status.unreadCount : 0,
              categories:
                status.state === 'ok' ? status.categories : undefined,
            };
          } catch {
            return {
              id: integration.id,
              state: 'unavailable' as const,
              unreadCount: 0,
            };
          }
        })
      )
    );

    return {
      statuses: Object.fromEntries(
        statuses.map((status) => [status.id, status])
      ),
    };
  }

  private async checkChannelNoticeResult(
    org: Organization,
    integration: Integration,
    provider: SocialProvider,
    since: Date,
    forceRefresh = false
  ): Promise<ChannelNoticeStatus> {
    const liveIntegration = { ...integration };

    if (
      dayjs(liveIntegration.tokenExpiration).isBefore(dayjs()) ||
      forceRefresh
    ) {
      const data = await this._refreshIntegrationService.refresh(
        liveIntegration
      );
      if (!data) {
        return { state: 'unavailable' };
      }

      if (data.accessToken) {
        liveIntegration.token = data.accessToken;
        if (provider.refreshWait) {
          await timer(10000);
        }
      } else {
        await this.disconnectChannel(org.id, liveIntegration);
        return { state: 'unavailable' };
      }
    }

    const cacheKey = `integration:notices:${org.id}:${liveIntegration.id}:${since.toISOString()}`;
    const cached = await ioRedis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ChannelNoticeStatus;
    }

    try {
      const status = await provider.channelNotices!(
        liveIntegration,
        liveIntegration.token,
        since
      );
      await ioRedis.set(
        cacheKey,
        JSON.stringify(status),
        'EX',
        !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
          ? 1
          : 300
      );
      return status;
    } catch (e) {
      if (e instanceof RefreshToken) {
        return this.checkChannelNoticeResult(
          org,
          liveIntegration,
          provider,
          since,
          true
        );
      }
      return { state: 'unavailable' };
    }
  }

  async markChannelNoticesRead(
    org: Organization,
    user: User,
    integrationId: string
  ) {
    const integration = await this._integrationRepository.getIntegrationById(
      org.id,
      integrationId
    );
    if (!integration) {
      throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
    }

    await this._integrationRepository.markIntegrationNoticesRead(
      user.id,
      integration.id
    );

    return { success: true };
  }

  customers(orgId: string) {
    return this._integrationRepository.customers(orgId);
  }

  getPlugsByIntegrationId(org: string, integrationId: string) {
    return this._integrationRepository.getPlugsByIntegrationId(
      org,
      integrationId
    );
  }

  async processInternalPlug(
    data: {
      post: string;
      originalIntegration: string;
      integration: string;
      plugName: string;
      orgId: string;
      delay: number;
      information: any;
    },
    forceRefresh = false
  ): Promise<any> {
    const originalIntegration =
      await this._integrationRepository.getIntegrationById(
        data.orgId,
        data.originalIntegration
      );

    const getIntegration = await this._integrationRepository.getIntegrationById(
      data.orgId,
      data.integration
    );

    if (!getIntegration || !originalIntegration) {
      return;
    }

    const getAllInternalPlugs = this._integrationManager
      .getInternalPlugs(getIntegration.providerIdentifier)
      .internalPlugs.find((p: any) => p.identifier === data.plugName);

    if (!getAllInternalPlugs) {
      return;
    }

    const getSocialIntegration = this._integrationManager.getSocialIntegration(
      getIntegration.providerIdentifier
    );

    // @ts-ignore
    await getSocialIntegration?.[getAllInternalPlugs.methodName]?.(
      getIntegration,
      originalIntegration,
      data.post,
      data.information
    );

    return;
  }

  async processPlugs(data: {
    plugId: string;
    postId: string;
    delay: number;
    totalRuns: number;
    currentRun: number;
    source?: 'channel' | 'pipeline';
  }) {
    const getPlugById = await this._pipelinePlugService.getForExecution(
      data.source || 'channel',
      data.plugId
    );
    if (!getPlugById || !getPlugById.activated) {
      return true;
    }

    const integration = this._integrationManager.getSocialIntegration(
      getPlugById.integration.providerIdentifier
    );

    // @ts-ignore
    const process = await integration[getPlugById.plugFunction](
      getPlugById.integration,
      data.postId,
      JSON.parse(getPlugById.data).reduce((all: any, current: any) => {
        all[current.name] = current.value;
        return all;
      }, {})
    );

    if (process) {
      return true;
    }

    if (data.totalRuns === data.currentRun) {
      return true;
    }

    return false;
  }

  async createOrUpdatePlug(
    orgId: string,
    integrationId: string,
    body: PlugDto
  ) {
    const { activated } = await this._integrationRepository.createOrUpdatePlug(
      orgId,
      integrationId,
      body
    );

    return {
      activated,
    };
  }

  async changePlugActivation(orgId: string, plugId: string, status: boolean) {
    const { id, integrationId, plugFunction } =
      await this._integrationRepository.changePlugActivation(
        orgId,
        plugId,
        status
      );

    return { id };
  }

  async getPlugs(orgId: string, integrationId: string) {
    return this._integrationRepository.getPlugs(orgId, integrationId);
  }

  async loadExisingData(
    methodName: string,
    integrationId: string,
    id: string[]
  ) {
    const exisingData = await this._integrationRepository.loadExisingData(
      methodName,
      integrationId,
      id
    );
    const loadOnlyIds = exisingData.map((p) => p.value);
    return difference(id, loadOnlyIds);
  }

  async findFreeDateTime(
    orgId: string,
    integrationsId?: string
  ): Promise<number[]> {
    const findTimes = await this._integrationRepository.getPostingTimes(
      orgId,
      integrationsId
    );
    return uniq(
      findTimes.reduce((all: any, current: any) => {
        return [
          ...all,
          ...JSON.parse(current.postingTimes).map(
            (p: { time: number }) => p.time
          ),
        ];
      }, [] as number[])
    );
  }

  private async requestInteractionReconciliation(integration: Integration) {
    try {
      await this._channelInteractionService.requestReconciliation(integration);
      await this.pokeChannelInteractionMaintenance();
    } catch {
      // Reconciliation is best-effort state preparation; it must not fail a channel operation.
    }
  }

  private async pokeChannelInteractionMaintenance() {
    try {
      const workflow = this._temporalService.client?.getRawClient()?.workflow;
      await workflow
        ?.getHandle('channel-interaction-maintenance-workflow-v1')
        .signal('channelInteractionMaintenance');
    } catch {
      // The workflow may not be running yet; its hourly pass reconciles persisted state.
    }
  }

  private async requestInteractionRemoval(integration: Integration) {
    try {
      await this._channelInteractionService.requestSubscriptionRemoval(integration);
      await this.pokeChannelInteractionMaintenance();
    } catch {
      // Remote cleanup is performed by maintenance and never blocks local disable/delete.
    }
  }
}
