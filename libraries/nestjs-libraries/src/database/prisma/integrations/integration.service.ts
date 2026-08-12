import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { IntegrationRepository } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import {
  AnalyticsData,
  ChannelNoticeStatus,
  ChannelInteractionKindCoverage,
  ChannelInteractionTrackingFailureCategory,
  FollowerPageTracking,
  Follower,
  FollowerPage,
  FollowerQuery,
  FollowerSort,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import {
  FOLLOWER_DATABASE_INTERACTIONS_SORT,
  isPageScopedFollowerSort,
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
  ChannelInteractionRepository,
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

    const sort = this.validateFollowerQuery(provider, query);
    if (sort?.scope === 'database') {
      return this.getDatabaseFollowerPage(org.id, integration, provider, query, sort);
    }

    try {
      return await this.getFollowerPage(integration, provider, query);
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

  private validateFollowerQuery(
    provider: SocialProvider,
    query: FollowerQuery
  ): FollowerSort | undefined {
    if (query.cursor && this.isHttpUrl(query.cursor)) {
      throw new HttpException('Invalid follower cursor', HttpStatus.BAD_REQUEST);
    }

    if (!query.sort && !query.direction) {
      if (query.cursor?.startsWith('follower-rank:v1:')) {
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
      if (!sort.requiresWindow || !query.window) {
        throw new HttpException(
          'A time window is required for this follower sort',
          HttpStatus.BAD_REQUEST
        );
      }
      return sort;
    }
    if (query.cursor?.startsWith('follower-rank:v1:')) {
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
    });
    if (cursor && ranked.rollup?.activeGeneration !== cursor.generation) {
      throw new HttpException('Invalid follower cursor', HttpStatus.BAD_REQUEST);
    }
    const tracking = this.getInteractionTrackingMetadata(
      ranked.followerSync,
      ranked.subscriptions,
      provider.channelInteractionWebhooks!.getInteractionCoverage(),
      ranked.rollup?.computedAt
    );
    if (
      !ranked.rollup ||
      !ranked.followerSync?.activeGeneration ||
      !ranked.followerSync.completedAt
    ) {
      return { items: [], hasMore: false, window, tracking };
    }

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
      coverage
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
    computedAt?: Date
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
        : coverage.some(
            (item) =>
              item.inbound === 'partial' || item.outbound === 'partial'
          )
          ? 'partial'
          : 'active';
    const availability =
      followerSync?.activeGeneration && followerSync.completedAt && computedAt
        ? 'ready'
        : state === 'error' || state === 'unconfigured'
          ? 'unavailable'
          : 'provisioning';
    const trackingStartedAt = subscriptions
      .map((subscription) => subscription.trackingStartedAt)
      .filter((startedAt): startedAt is Date => !!startedAt)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const failureCategory = this.trackingFailureCategory(
      failedSubscription?.failureCategory
    );
    return {
      state,
      availability,
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
        ? { ...query, sort: undefined, direction: undefined }
        : query;
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
    };
  }

  private getFollowerSorts(provider: SocialProvider) {
    const sorts = provider.followerSorts || [];
    return provider.channelInteractionWebhooks &&
      !sorts.some((sort) => sort.key === FOLLOWER_DATABASE_INTERACTIONS_SORT.key)
      ? [...sorts, FOLLOWER_DATABASE_INTERACTIONS_SORT]
      : sorts;
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
