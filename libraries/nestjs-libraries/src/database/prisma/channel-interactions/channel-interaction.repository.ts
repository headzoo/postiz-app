import { Injectable } from '@nestjs/common';
import {
  ChannelAudienceMembership,
  ChannelFollowerSyncStatus,
  ChannelInteractionDirection,
  ChannelInteractionKind,
  ChannelInteractionTrackingState,
  ChannelInteractionWindow,
  Prisma,
} from '@prisma/client';
import { ChannelInteractionSubscriptionReconciliationResult } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import {
  PrismaRepository,
  PrismaTransaction,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

export type AudienceProfile = {
  externalId: string;
  name?: string;
  username?: string;
  picture?: string;
  profileUrl?: string;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
  followedAt?: Date;
  accountCreatedAt?: Date;
};

export type PersistedInteraction = {
  providerEventKey: string;
  kind: ChannelInteractionKind;
  direction: ChannelInteractionDirection;
  eventAt: Date;
  counterparty: AudienceProfile;
  relatedObjectId?: string;
  metadata?: Record<string, string>;
  normalizationVersion: number;
  membershipUpdate?: ChannelAudienceMembership;
  score: number;
};

export type DesiredInteractionSubscription = {
  eventKey: string;
  direction: ChannelInteractionDirection;
};

export type RankedFollowerCursor = {
  interactionCount: number;
  interactionScore: number;
  lastInteractionAt: string | null;
  externalId: string;
};

export type RankedFollowersQuery = {
  organizationId: string;
  integrationId: string;
  window: ChannelInteractionWindow;
  direction: 'asc' | 'desc';
  limit: number;
  cursor?: RankedFollowerCursor;
};

const TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class ChannelInteractionRepository {
  constructor(
    private _dailyAggregate: PrismaRepository<
      | 'channelInteractionDailyAggregate'
      | 'channelInteractionEvent'
      | 'channelInteractionWindowSummary'
      | 'channelInteractionRollupState'
      | 'channelFollowerSyncState'
    >,
    private _integration: PrismaRepository<'integration'>,
    private _subscription: PrismaRepository<'channelInteractionSubscription'>,
    private _transaction: PrismaTransaction
  ) {}

  async recordNormalizedEvent(
    organizationId: string,
    integrationId: string,
    event: PersistedInteraction
  ): Promise<{ created: boolean }> {
    return this.withSerializableRetry(async (tx) => {
      await this.assertOwnedIntegration(tx, organizationId, integrationId);
      const inserted = await tx.channelInteractionEvent.createMany({
        data: [{
          organizationId,
          integrationId,
          providerEventKey: event.providerEventKey,
          counterpartyExternalId: event.counterparty.externalId,
          kind: event.kind,
          direction: event.direction,
          eventAt: event.eventAt,
          relatedObjectId: event.relatedObjectId,
          metadata: event.metadata,
          normalizationVersion: event.normalizationVersion,
        }],
        skipDuplicates: true,
      });
      if (!inserted.count) {
        return { created: false };
      }
      await this.upsertAudienceMember(
        tx,
        organizationId,
        integrationId,
        event.counterparty,
        event.membershipUpdate
      );

      const day = new Date(Date.UTC(
        event.eventAt.getUTCFullYear(),
        event.eventAt.getUTCMonth(),
        event.eventAt.getUTCDate()
      ));
      await tx.channelInteractionDailyAggregate.upsert({
        where: {
          integrationId_counterpartyExternalId_day: {
            integrationId,
            counterpartyExternalId: event.counterparty.externalId,
            day,
          },
        },
        create: {
          organizationId,
          integrationId,
          counterpartyExternalId: event.counterparty.externalId,
          day,
          interactionCount: 1,
          interactionScore: event.score,
          lastInteractionAt: event.eventAt,
        },
        update: {
          interactionCount: { increment: 1 },
          interactionScore: { increment: event.score },
        },
      });
      await tx.channelInteractionDailyAggregate.updateMany({
        where: {
          integrationId,
          counterpartyExternalId: event.counterparty.externalId,
          day,
          OR: [
            { lastInteractionAt: null },
            { lastInteractionAt: { lt: event.eventAt } },
          ],
        },
        data: { lastInteractionAt: event.eventAt },
      });
      return { created: true };
    });
  }

  getActiveIntegrationsForAccount(
    providerIdentifier: string,
    internalId: string
  ) {
    return this._integration.model.integration.findMany({
      where: {
        providerIdentifier,
        internalId,
        type: 'social',
        disabled: false,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });
  }

  async listMaintenanceCandidates(after?: string, take = 1) {
    const integrations = await this._integration.model.integration.findMany({
      where: {
        type: 'social',
        OR: [
          { disabled: false, deletedAt: null },
          {
            OR: [{ disabled: true }, { deletedAt: { not: null } }],
            channelInteractionSubscriptions: {
              some: { state: ChannelInteractionTrackingState.REMOVING },
            },
          },
        ],
        ...(after ? { id: { gt: after } } : {}),
      },
      orderBy: { id: 'asc' },
      take: take + 1,
      select: {
        id: true,
        organizationId: true,
        disabled: true,
        deletedAt: true,
      },
    });
    const hasMore = integrations.length > take;
    return {
      candidates: integrations.slice(0, take).map((integration) => ({
        id: integration.id,
        organizationId: integration.organizationId,
        maintenance: integration.disabled || integration.deletedAt
          ? 'cleanup' as const
          : 'active' as const,
      })),
      next: hasMore ? integrations[take - 1]?.id : undefined,
    };
  }

  async applySubscriptionReconciliation(
    organizationId: string,
    integrationId: string,
    result: ChannelInteractionSubscriptionReconciliationResult,
    cleanupPending = false
  ) {
    return this.withSerializableRetry(async (tx) => {
      await this.assertOwnedIntegration(tx, organizationId, integrationId);
      const trackingStartedAt = new Date();
      for (const subscription of result.subscriptions) {
        const cleanupComplete =
          cleanupPending &&
          subscription.state === 'unconfigured' &&
          !subscription.failureCategory;
        await tx.channelInteractionSubscription.updateMany({
          where: {
            organizationId,
            integrationId,
            eventKey: subscription.eventKey,
            direction:
              subscription.direction === 'inbound'
                ? ChannelInteractionDirection.INBOUND
                : ChannelInteractionDirection.OUTBOUND,
          },
          data: {
            remoteIdentifier: subscription.remoteIdentifier,
            state: cleanupPending
              ? cleanupComplete
                ? ChannelInteractionTrackingState.UNCONFIGURED
                : ChannelInteractionTrackingState.REMOVING
              : subscription.state.toUpperCase() as ChannelInteractionTrackingState,
            failureCategory: subscription.failureCategory || null,
            failureReason: subscription.failureCategory
              ? this.failureReason(subscription.failureCategory)
              : null,
          },
        });
        if (subscription.state === 'active') {
          await tx.channelInteractionSubscription.updateMany({
            where: {
              organizationId,
              integrationId,
              eventKey: subscription.eventKey,
              direction:
                subscription.direction === 'inbound'
                  ? ChannelInteractionDirection.INBOUND
                  : ChannelInteractionDirection.OUTBOUND,
              trackingStartedAt: null,
            },
            data: { trackingStartedAt },
          });
        }
      }
    });
  }

  async requestSubscriptionReconciliation(
    organizationId: string,
    integrationId: string,
    desiredSubscriptions: DesiredInteractionSubscription[]
  ) {
    return this.withSerializableRetry(async (tx) => {
      await this.assertOwnedIntegration(tx, organizationId, integrationId);
      for (const subscription of desiredSubscriptions) {
        await tx.channelInteractionSubscription.upsert({
          where: {
            integrationId_eventKey_direction: {
              integrationId,
              eventKey: subscription.eventKey,
              direction: subscription.direction,
            },
          },
          create: {
            organizationId,
            integrationId,
            eventKey: subscription.eventKey,
            direction: subscription.direction,
            state: ChannelInteractionTrackingState.PROVISIONING,
          },
          update: {
            state: ChannelInteractionTrackingState.PROVISIONING,
            failureCategory: null,
            failureReason: null,
          },
        });
      }
    });
  }

  async markSubscriptionsForRemoval(
    organizationId: string,
    integrationId: string
  ) {
    return this._subscription.model.channelInteractionSubscription.updateMany({
      where: { organizationId, integrationId },
      data: {
        state: ChannelInteractionTrackingState.REMOVING,
        failureCategory: null,
        failureReason: null,
      },
    });
  }

  async applyMembershipUpdate(
    organizationId: string,
    integrationId: string,
    profile: AudienceProfile,
    membership: ChannelAudienceMembership
  ) {
    return this.withSerializableRetry(async (tx) => {
      await this.assertOwnedIntegration(tx, organizationId, integrationId);
      return this.upsertAudienceMember(
        tx,
        organizationId,
        integrationId,
        profile,
        membership
      );
    });
  }

  async beginFollowerSync(
    organizationId: string,
    integrationId: string,
    generation: string
  ) {
    return this.withSerializableRetry(async (tx) => {
      await this.assertOwnedIntegration(tx, organizationId, integrationId);
      await tx.channelFollowerSyncState.upsert({
        where: { integrationId },
        create: {
          organizationId,
          integrationId,
          pendingGeneration: generation,
          status: ChannelFollowerSyncStatus.IN_PROGRESS,
        },
        update: {
          organizationId,
          pendingGeneration: generation,
          status: ChannelFollowerSyncStatus.IN_PROGRESS,
        },
      });
      return generation;
    });
  }

  async applyFollowerSyncPage(
    organizationId: string,
    integrationId: string,
    generation: string,
    followers: AudienceProfile[]
  ): Promise<boolean> {
    return this.withSerializableRetry(async (tx) => {
      const claimed = await tx.channelFollowerSyncState.updateMany({
        where: {
          organizationId,
          integrationId,
          pendingGeneration: generation,
          status: ChannelFollowerSyncStatus.IN_PROGRESS,
        },
        data: { status: ChannelFollowerSyncStatus.IN_PROGRESS },
      });
      if (claimed.count !== 1) {
        return false;
      }
      for (const follower of followers) {
        await this.upsertAudienceMember(
          tx,
          organizationId,
          integrationId,
          follower,
          ChannelAudienceMembership.FOLLOWER,
          generation
        );
      }
      return true;
    });
  }

  async completeFollowerSync(
    organizationId: string,
    integrationId: string,
    generation: string,
    completedAt: Date
  ): Promise<boolean> {
    return this.withSerializableRetry(async (tx) => {
      const completed = await tx.channelFollowerSyncState.updateMany({
        where: {
          organizationId,
          integrationId,
          pendingGeneration: generation,
          status: ChannelFollowerSyncStatus.IN_PROGRESS,
        },
        data: { status: ChannelFollowerSyncStatus.IN_PROGRESS },
      });
      if (completed.count !== 1) {
        return false;
      }
      await tx.channelAudienceMember.updateMany({
        where: {
          organizationId,
          integrationId,
          followerSyncGeneration: generation,
          OR: [
            { membershipEvidenceGeneration: null },
            { membershipEvidenceGeneration: { not: generation } },
          ],
        },
        data: { membershipState: ChannelAudienceMembership.FOLLOWER },
      });
      await tx.channelAudienceMember.updateMany({
        where: {
          organizationId,
          integrationId,
          membershipState: ChannelAudienceMembership.FOLLOWER,
          AND: [
            {
              OR: [
                { followerSyncGeneration: null },
                { followerSyncGeneration: { not: generation } },
              ],
            },
            {
              OR: [
                { membershipEvidenceGeneration: null },
                { membershipEvidenceGeneration: { not: generation } },
              ],
            },
          ],
        },
        data: { membershipState: ChannelAudienceMembership.NOT_FOLLOWER },
      });
      await tx.channelFollowerSyncState.update({
        where: { integrationId },
        data: {
          activeGeneration: generation,
          pendingGeneration: null,
          status: ChannelFollowerSyncStatus.COMPLETE,
          completedAt,
        },
      });
      return true;
    });
  }

  async failFollowerSync(
    organizationId: string,
    integrationId: string,
    generation: string
  ): Promise<boolean> {
    const result = await this.withSerializableRetry((tx) =>
      tx.channelFollowerSyncState.updateMany({
        where: {
          organizationId,
          integrationId,
          pendingGeneration: generation,
          status: ChannelFollowerSyncStatus.IN_PROGRESS,
        },
        data: {
          pendingGeneration: null,
          status: ChannelFollowerSyncStatus.FAILED,
        },
      })
    );
    return result.count === 1;
  }

  async rebuildWindowSummary(
    organizationId: string,
    integrationId: string,
    window: ChannelInteractionWindow,
    generation: string,
    cutoffAt: Date,
    computedAt: Date
  ) {
    return this.withSerializableRetry(async (tx) => {
      await this.assertOwnedIntegration(tx, organizationId, integrationId);
      const aggregates = await tx.channelInteractionEvent.groupBy({
        by: ['counterpartyExternalId', 'kind', 'direction'],
        where: {
          organizationId,
          integrationId,
          eventAt: { gte: cutoffAt, lte: computedAt },
        },
        _count: { _all: true },
        _max: { eventAt: true },
      });
      const followers = await tx.channelAudienceMember.findMany({
        where: {
          organizationId,
          integrationId,
          membershipState: ChannelAudienceMembership.FOLLOWER,
        },
        select: { externalId: true },
      });
      const summaries = new Map<string, {
        interactionCount: number;
        interactionScore: number;
        lastInteractionAt: Date | null;
      }>();
      for (const aggregate of aggregates) {
        const current = summaries.get(aggregate.counterpartyExternalId) || {
          interactionCount: 0,
          interactionScore: 0,
          lastInteractionAt: null,
        };
        const count = aggregate._count._all;
        const lastInteractionAt = aggregate._max.eventAt;
        current.interactionCount += count;
        current.interactionScore += count * this.interactionScore(
          aggregate.kind,
          aggregate.direction
        );
        if (
          lastInteractionAt &&
          (!current.lastInteractionAt || lastInteractionAt > current.lastInteractionAt)
        ) {
          current.lastInteractionAt = lastInteractionAt;
        }
        summaries.set(aggregate.counterpartyExternalId, current);
      }
      const followerSummaries = followers.map(({ externalId }) => ({
        counterpartyExternalId: externalId,
        ...(summaries.get(externalId) || {
          interactionCount: 0,
          interactionScore: 0,
          lastInteractionAt: null,
        }),
      }));
      if (followerSummaries.length) {
        await tx.channelInteractionWindowSummary.createMany({
          data: followerSummaries.map((summary) => ({
            organizationId,
            integrationId,
            window,
            generation,
            ...summary,
            computedAt,
          })),
          skipDuplicates: true,
        });
      }
      await tx.channelInteractionRollupState.upsert({
        where: { integrationId_window: { integrationId, window } },
        create: {
          organizationId,
          integrationId,
          window,
          activeGeneration: generation,
          computedAt,
        },
        update: {
          organizationId,
          activeGeneration: generation,
          computedAt,
        },
      });
      await tx.channelInteractionWindowSummary.deleteMany({
        where: {
          organizationId,
          integrationId,
          window,
          generation: { not: generation },
        },
      });
      return { generation, computedAt, itemCount: followerSummaries.length };
    });
  }

  async getRankedFollowers(query: RankedFollowersQuery) {
    return this.withSerializableRetry(async (tx) => {
      const [rollup, followerSync, subscriptions] = await Promise.all([
        tx.channelInteractionRollupState.findFirst({
        where: {
          organizationId: query.organizationId,
          integrationId: query.integrationId,
          window: query.window,
        },
        select: {
          activeGeneration: true,
          computedAt: true,
        },
      }),
        tx.channelFollowerSyncState.findFirst({
        where: {
          organizationId: query.organizationId,
          integrationId: query.integrationId,
        },
        select: {
            activeGeneration: true,
          status: true,
          completedAt: true,
        },
      }),
        tx.channelInteractionSubscription.findMany({
        where: {
          organizationId: query.organizationId,
          integrationId: query.integrationId,
        },
        select: {
          state: true,
          trackingStartedAt: true,
          failureCategory: true,
          failureReason: true,
        },
      }),
      ]);

      if (!rollup || !followerSync?.activeGeneration || !followerSync.completedAt) {
        return {
          items: [],
          hasMore: false,
          rollup,
          followerSync,
          subscriptions,
        };
      }

      const rows = await tx.channelInteractionWindowSummary.findMany({
      where: {
        organizationId: query.organizationId,
        integrationId: query.integrationId,
        window: query.window,
        generation: rollup.activeGeneration,
        audienceMember: {
          is: {
            organizationId: query.organizationId,
            integrationId: query.integrationId,
            membershipState: ChannelAudienceMembership.FOLLOWER,
          },
        },
        ...this.rankedFollowerKeyset(query.cursor, query.direction),
      },
      orderBy: [
        { interactionCount: query.direction },
        { interactionScore: query.direction },
        { lastInteractionAt: query.direction },
        { counterpartyExternalId: query.direction },
      ],
      take: query.limit + 1,
      select: {
        counterpartyExternalId: true,
        interactionCount: true,
        interactionScore: true,
        lastInteractionAt: true,
        audienceMember: {
          select: {
            name: true,
            username: true,
            picture: true,
            profileUrl: true,
            bio: true,
            followersCount: true,
            followingCount: true,
            followedAt: true,
            accountCreatedAt: true,
          },
        },
      },
    });

      return {
        items: rows.slice(0, query.limit),
        hasMore: rows.length > query.limit,
        rollup,
        followerSync,
        subscriptions,
      };
    });
  }

  async getInteractionTracking(organizationId: string, integrationId: string) {
    const [followerSync, subscriptions] = await Promise.all([
      this._dailyAggregate.model.channelFollowerSyncState.findFirst({
        where: { organizationId, integrationId },
        select: { activeGeneration: true, status: true, completedAt: true },
      }),
      this._subscription.model.channelInteractionSubscription.findMany({
        where: { organizationId, integrationId },
        select: {
          state: true,
          trackingStartedAt: true,
          failureCategory: true,
          failureReason: true,
        },
      }),
    ]);
    return { followerSync, subscriptions };
  }

  private rankedFollowerKeyset(
    cursor: RankedFollowerCursor | undefined,
    direction: 'asc' | 'desc'
  ): Prisma.ChannelInteractionWindowSummaryWhereInput {
    if (!cursor) {
      return {};
    }

    const comparison = direction === 'desc' ? 'lt' : 'gt';
    const timeComparison: Prisma.ChannelInteractionWindowSummaryWhereInput =
      cursor.lastInteractionAt
      ? direction === 'desc'
        ? { lastInteractionAt: { lt: new Date(cursor.lastInteractionAt) } }
        : {
          OR: [
            { lastInteractionAt: { gt: new Date(cursor.lastInteractionAt) } },
            { lastInteractionAt: null },
          ],
        }
      : direction === 'desc'
        ? { lastInteractionAt: { not: null } }
        : { OR: [] };
    const externalIdComparison = { [comparison]: cursor.externalId };

    return {
      OR: [
        { interactionCount: { [comparison]: cursor.interactionCount } },
        {
          interactionCount: cursor.interactionCount,
          interactionScore: { [comparison]: cursor.interactionScore },
        },
        {
          interactionCount: cursor.interactionCount,
          interactionScore: cursor.interactionScore,
          ...timeComparison,
        },
        {
          interactionCount: cursor.interactionCount,
          interactionScore: cursor.interactionScore,
          lastInteractionAt: cursor.lastInteractionAt
            ? new Date(cursor.lastInteractionAt)
            : null,
          counterpartyExternalId: externalIdComparison,
        },
      ],
    };
  }

  private interactionScore(
    kind: ChannelInteractionKind,
    direction: ChannelInteractionDirection
  ) {
    const inbound = direction === ChannelInteractionDirection.INBOUND;
    return {
      [ChannelInteractionKind.LIKE]: inbound ? 2 : 1,
      [ChannelInteractionKind.MENTION]: inbound ? 4 : 2,
      [ChannelInteractionKind.REPOST]: inbound ? 6 : 3,
      [ChannelInteractionKind.REPLY]: inbound ? 8 : 4,
      [ChannelInteractionKind.FOLLOW]: inbound ? 10 : 5,
    }[kind];
  }

  private failureReason(
    category: NonNullable<
      ChannelInteractionSubscriptionReconciliationResult['subscriptions'][number]['failureCategory']
    >
  ) {
    return {
      configuration: 'Tracking configuration is incomplete.',
      authentication: 'Tracking authentication needs attention.',
      authorization: 'Tracking permissions do not allow this subscription.',
      entitlement: 'This provider plan does not include this tracking feature.',
      quota: 'The provider tracking quota has been reached.',
      transient: 'The provider is temporarily unavailable.',
      unknown: 'Tracking setup could not be completed.',
    }[category];
  }

  private async assertOwnedIntegration(
    tx: Prisma.TransactionClient,
    organizationId: string,
    integrationId: string
  ) {
    const integration = await tx.integration.findFirst({
      where: { id: integrationId, organizationId },
      select: { id: true },
    });
    if (!integration) {
      throw new Error('Channel integration does not belong to organization');
    }
  }

  private async upsertAudienceMember(
    tx: Prisma.TransactionClient,
    organizationId: string,
    integrationId: string,
    profile: AudienceProfile,
    membership?: ChannelAudienceMembership,
    followerSyncGeneration?: string
  ) {
    const membershipEvidenceGeneration =
      membership && !followerSyncGeneration
        ? (
          await tx.channelFollowerSyncState.findFirst({
            where: {
              organizationId,
              integrationId,
              pendingGeneration: { not: null },
              status: ChannelFollowerSyncStatus.IN_PROGRESS,
            },
            select: { pendingGeneration: true },
          })
        )?.pendingGeneration || null
        : undefined;
    const profileData = {
      ...(profile.name !== undefined ? { name: profile.name } : {}),
      ...(profile.username !== undefined ? { username: profile.username } : {}),
      ...(profile.picture !== undefined ? { picture: profile.picture } : {}),
      ...(profile.profileUrl !== undefined ? { profileUrl: profile.profileUrl } : {}),
      ...(profile.bio !== undefined ? { bio: profile.bio } : {}),
      ...(profile.followersCount !== undefined
        ? { followersCount: profile.followersCount }
        : {}),
      ...(profile.followingCount !== undefined
        ? { followingCount: profile.followingCount }
        : {}),
      ...(profile.followedAt !== undefined ? { followedAt: profile.followedAt } : {}),
      ...(profile.accountCreatedAt !== undefined
        ? { accountCreatedAt: profile.accountCreatedAt }
        : {}),
    };
    return tx.channelAudienceMember.upsert({
      where: {
        integrationId_externalId: {
          integrationId,
          externalId: profile.externalId,
        },
      },
      create: {
        organizationId,
        integrationId,
        externalId: profile.externalId,
        ...profileData,
        ...(membership && !followerSyncGeneration
          ? {
            membershipState: membership,
            membershipEvidenceGeneration,
          }
          : {}),
        ...(followerSyncGeneration ? { followerSyncGeneration } : {}),
      },
      update: {
        ...profileData,
        ...(membership && !followerSyncGeneration
          ? {
            membershipState: membership,
            membershipEvidenceGeneration,
          }
          : {}),
        ...(followerSyncGeneration ? { followerSyncGeneration } : {}),
      },
    });
  }

  private async withSerializableRetry<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < TRANSACTION_ATTEMPTS; attempt++) {
      try {
        return await (this._transaction.model as any).$transaction(callback, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: any) {
        lastError = error;
        if (error?.code !== 'P2034' || attempt === TRANSACTION_ATTEMPTS - 1) {
          throw error;
        }
      }
    }
    throw lastError;
  }
}
