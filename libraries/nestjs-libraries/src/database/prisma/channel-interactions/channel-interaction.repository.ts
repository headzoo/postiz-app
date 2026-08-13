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
import { AudienceFollowerSortField } from '@gitroom/nestjs-libraries/integrations/social/follower.sorts';
import {
  PrismaRepository,
  PrismaTransaction,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { getChannelInteractionScore } from './channel-interaction.scoring';

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
  search?: string;
};

export type NoteCountFollowerCursor = {
  noteCount: number;
  externalId: string;
};

export type NoteCountFollowersQuery = {
  organizationId: string;
  integrationId: string;
  direction: 'asc' | 'desc';
  limit: number;
  cursor?: NoteCountFollowerCursor;
  search?: string;
};

export type AudienceFollowerCursor = {
  sortField: AudienceFollowerSortField;
  sortValue: string | number | null;
  externalId: string;
};

export type AudienceFollowersQuery = {
  organizationId: string;
  integrationId: string;
  search: string;
  sortField: AudienceFollowerSortField;
  direction: 'asc' | 'desc';
  limit: number;
  cursor?: AudienceFollowerCursor;
};

export type FollowerInteractionMetrics = {
  interactionCount: number;
  interactionScore: number;
  lastInteractionAt: Date | null;
};

const TRANSACTION_ATTEMPTS = 3;
const RELATIONSHIP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const RELATIONSHIP_BATCH_SIZE = 100;

export type RelationshipGradeBatchMember = {
  externalId: string;
  effortScore: number;
  reciprocationScore: number;
};

export type RelationshipGradeSnapshotInput = RelationshipGradeBatchMember & {
  reciprocity: number | null;
  grade: number | null;
  formulaVersion: number;
};

@Injectable()
export class ChannelInteractionRepository {
  constructor(
    private _dailyAggregate: PrismaRepository<
      | 'channelInteractionDailyAggregate'
      | 'channelInteractionEvent'
      | 'channelInteractionWindowSummary'
      | 'channelInteractionRollupState'
      | 'channelFollowerSyncState'
      | 'channelAudienceMember'
      | 'channelAudienceNote'
      | 'channelRelationshipGradeSnapshot'
    >,
    private _integration: PrismaRepository<'integration'>,
    private _subscription: PrismaRepository<'channelInteractionSubscription'>,
    private _transaction: PrismaTransaction
  ) { }

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
        current.interactionScore += count * getChannelInteractionScore(
          aggregate.kind.toLowerCase() as Parameters<
            typeof getChannelInteractionScore
          >[0],
          aggregate.direction.toLowerCase() as Parameters<
            typeof getChannelInteractionScore
          >[1]
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
              ...this.audienceSearchFilter(query.search),
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

  async listDueRelationshipGradeCandidates(
    snapshotAt: Date,
    after?: string,
    take = 1
  ) {
    const dueCutoff = this.relationshipDueCutoff(snapshotAt);
    const integrations = await this._integration.model.integration.findMany({
      where: {
        type: 'social',
        disabled: false,
        deletedAt: null,
        channelFollowerSyncState: {
          is: {
            status: ChannelFollowerSyncStatus.COMPLETE,
            completedAt: { not: null },
          },
        },
        channelInteractionSubscriptions: {
          some: {
            state: {
              in: [
                ChannelInteractionTrackingState.ACTIVE,
                ChannelInteractionTrackingState.PARTIAL,
              ],
            },
          },
        },
        channelAudienceMembers: {
          some: {
            membershipState: ChannelAudienceMembership.FOLLOWER,
            gradeSnapshots: { none: { snapshotAt: { gt: dueCutoff } } },
          },
        },
        ...(after ? { id: { gt: after } } : {}),
      },
      orderBy: { id: 'asc' },
      take: take + 1,
      select: { id: true, organizationId: true },
    });
    return {
      candidates: integrations.slice(0, take),
      next: integrations.length > take ? integrations[take - 1]?.id : undefined,
    };
  }

  async getDueRelationshipGradeBatch(
    organizationId: string,
    integrationId: string,
    snapshotAt: Date,
    take = RELATIONSHIP_BATCH_SIZE
  ): Promise<{ members: RelationshipGradeBatchMember[] }> {
    const dueCutoff = this.relationshipDueCutoff(snapshotAt);
    return this.withSerializableRetry(async (tx) => {
      await this.assertOwnedIntegration(tx, organizationId, integrationId);
      const followers = await tx.channelAudienceMember.findMany({
        where: {
          organizationId,
          integrationId,
          membershipState: ChannelAudienceMembership.FOLLOWER,
          gradeSnapshots: { none: { snapshotAt: { gt: dueCutoff } } },
        },
        orderBy: { id: 'asc' },
        take,
        select: { externalId: true },
      });
      if (!followers.length) return { members: [] };
      const aggregates = await tx.channelInteractionEvent.groupBy({
        by: ['counterpartyExternalId', 'kind', 'direction'],
        where: {
          organizationId,
          integrationId,
          counterpartyExternalId: { in: followers.map(({ externalId }) => externalId) },
          eventAt: {
            gte: new Date(snapshotAt.getTime() - RELATIONSHIP_WINDOW_MS),
            lte: snapshotAt,
          },
        },
        _count: { _all: true },
      });
      const scores = new Map<string, RelationshipGradeBatchMember>();
      for (const { externalId } of followers) {
        scores.set(externalId, {
          externalId,
          effortScore: 0,
          reciprocationScore: 0,
        });
      }
      for (const aggregate of aggregates) {
        const member = scores.get(aggregate.counterpartyExternalId);
        if (!member) continue;
        const score =
          aggregate._count._all *
          getChannelInteractionScore(
            aggregate.kind.toLowerCase() as Parameters<
              typeof getChannelInteractionScore
            >[0],
            aggregate.direction.toLowerCase() as Parameters<
              typeof getChannelInteractionScore
            >[1]
          );
        if (aggregate.direction === ChannelInteractionDirection.OUTBOUND) {
          member.effortScore += score;
        } else {
          member.reciprocationScore += score;
        }
      }
      return { members: followers.map(({ externalId }) => scores.get(externalId)!) };
    });
  }

  async createRelationshipGradeSnapshots(
    organizationId: string,
    integrationId: string,
    snapshotAt: Date,
    snapshots: RelationshipGradeSnapshotInput[]
  ) {
    if (!snapshots.length) return { count: 0 };
    return this.withSerializableRetry(async (tx) => {
      await this.assertOwnedIntegration(tx, organizationId, integrationId);
      return tx.channelRelationshipGradeSnapshot.createMany({
        data: snapshots.map((snapshot) => ({
          organizationId,
          integrationId,
          counterpartyExternalId: snapshot.externalId,
          windowStartedAt: new Date(snapshotAt.getTime() - RELATIONSHIP_WINDOW_MS),
          snapshotAt,
          effortScore: snapshot.effortScore,
          reciprocationScore: snapshot.reciprocationScore,
          reciprocity: snapshot.reciprocity,
          grade: snapshot.grade,
          formulaVersion: snapshot.formulaVersion,
        })),
        skipDuplicates: true,
      });
    });
  }

  async hasDueRelationshipGradeMembers(
    organizationId: string,
    integrationId: string,
    snapshotAt: Date
  ) {
    const member = await this._dailyAggregate.model.channelAudienceMember.findFirst({
      where: {
        organizationId,
        integrationId,
        membershipState: ChannelAudienceMembership.FOLLOWER,
        gradeSnapshots: {
          none: { snapshotAt: { gt: this.relationshipDueCutoff(snapshotAt) } },
        },
      },
      select: { id: true },
    });
    return !!member;
  }

  async getFollowerInteractionMetrics(
    organizationId: string,
    integrationId: string,
    externalIds: string[]
  ): Promise<Map<string, FollowerInteractionMetrics>> {
    const uniqueIds = [...new Set(externalIds.filter(Boolean))];
    if (!uniqueIds.length) {
      return new Map();
    }

    const rows =
      await this._dailyAggregate.model.channelInteractionDailyAggregate.groupBy({
        by: ['counterpartyExternalId'],
        where: {
          organizationId,
          integrationId,
          counterpartyExternalId: { in: uniqueIds },
        },
        _sum: {
          interactionCount: true,
          interactionScore: true,
        },
        _max: {
          lastInteractionAt: true,
        },
      });

    return new Map(
      rows.map((row) => [
        row.counterpartyExternalId,
        {
          interactionCount: row._sum.interactionCount ?? 0,
          interactionScore: row._sum.interactionScore ?? 0,
          lastInteractionAt: row._max.lastInteractionAt ?? null,
        },
      ])
    );
  }

  async getFollowerDetails(
    organizationId: string,
    integrationId: string,
    externalId: string
  ) {
    return this.withSerializableRetry(async (tx) => {
      await this.assertOwnedIntegration(tx, organizationId, integrationId);
      const member = await tx.channelAudienceMember.findFirst({
        where: { organizationId, integrationId, externalId },
        include: {
          gradeSnapshots: { orderBy: { snapshotAt: 'asc' } },
          notes: {
            orderBy: { createdAt: 'desc' },
            include: {
              author: {
                select: { id: true, name: true, lastName: true, email: true },
              },
            },
          },
        },
      });
      if (!member) return null;
      const [events, tracking] = await Promise.all([
        tx.channelInteractionEvent.findMany({
          where: { organizationId, integrationId, counterpartyExternalId: externalId },
          orderBy: { eventAt: 'desc' },
          take: 20,
          select: {
            id: true,
            kind: true,
            direction: true,
            eventAt: true,
            relatedObjectId: true,
          },
        }),
        this.getInteractionTrackingInTransaction(tx, organizationId, integrationId),
      ]);
      return { member, snapshots: member.gradeSnapshots, notes: member.notes, events, tracking };
    });
  }

  async createAudienceNote(
    organizationId: string,
    integrationId: string,
    externalId: string,
    authorUserId: string,
    content: string
  ) {
    return this.withSerializableRetry(async (tx) => {
      await this.assertNoteAccess(tx, organizationId, integrationId, externalId, authorUserId);
      const note = await tx.channelAudienceNote.create({
        data: {
          organizationId,
          integrationId,
          counterpartyExternalId: externalId,
          authorUserId,
          content,
        },
        include: {
          author: {
            select: { id: true, name: true, lastName: true, email: true },
          },
        },
      });
      await tx.channelAudienceMember.updateMany({
        where: { organizationId, integrationId, externalId },
        data: { noteCount: { increment: 1 } },
      });
      return note;
    });
  }

  async updateAudienceNote(
    organizationId: string,
    integrationId: string,
    noteId: string,
    content: string
  ) {
    const result = await this._dailyAggregate.model.channelAudienceNote.updateMany({
      where: { id: noteId, organizationId, integrationId },
      data: { content },
    });
    return result.count === 1;
  }

  async deleteAudienceNote(organizationId: string, integrationId: string, noteId: string) {
    return this.withSerializableRetry(async (tx) => {
      const note = await tx.channelAudienceNote.findFirst({
        where: { id: noteId, organizationId, integrationId },
        select: { id: true, counterpartyExternalId: true },
      });
      if (!note) {
        return false;
      }

      const deleted = await tx.channelAudienceNote.deleteMany({
        where: { id: note.id, organizationId, integrationId },
      });
      if (deleted.count !== 1) {
        return false;
      }

      await tx.channelAudienceMember.updateMany({
        where: {
          organizationId,
          integrationId,
          externalId: note.counterpartyExternalId,
          noteCount: { gt: 0 },
        },
        data: { noteCount: { decrement: 1 } },
      });
      return true;
    });
  }

  async getFollowersByNoteCount(query: NoteCountFollowersQuery) {
    return this.withSerializableRetry(async (tx) => {
      await this.assertOwnedIntegration(
        tx,
        query.organizationId,
        query.integrationId
      );

      const rows = await tx.channelAudienceMember.findMany({
        where: {
          organizationId: query.organizationId,
          integrationId: query.integrationId,
          membershipState: ChannelAudienceMembership.FOLLOWER,
          ...this.audienceListFilters(
            this.audienceSearchFilter(query.search),
            this.noteCountFollowerKeyset(query.cursor, query.direction)
          ),
        },
        orderBy: [
          { noteCount: query.direction },
          { externalId: query.direction },
        ],
        take: query.limit + 1,
        select: {
          externalId: true,
          name: true,
          username: true,
          picture: true,
          profileUrl: true,
          bio: true,
          followersCount: true,
          followingCount: true,
          followedAt: true,
          accountCreatedAt: true,
          noteCount: true,
        },
      });

      return {
        items: rows.slice(0, query.limit),
        hasMore: rows.length > query.limit,
      };
    });
  }

  async getAudienceFollowers(query: AudienceFollowersQuery) {
    return this.withSerializableRetry(async (tx) => {
      await this.assertOwnedIntegration(
        tx,
        query.organizationId,
        query.integrationId
      );

      const rows = await tx.channelAudienceMember.findMany({
        where: {
          organizationId: query.organizationId,
          integrationId: query.integrationId,
          membershipState: ChannelAudienceMembership.FOLLOWER,
          ...this.audienceListFilters(
            this.audienceSearchFilter(query.search),
            this.audienceFollowerKeyset(query.cursor, query.direction)
          ),
        },
        orderBy: [
          { [query.sortField]: query.direction },
          { externalId: query.direction },
        ],
        take: query.limit + 1,
        select: {
          externalId: true,
          name: true,
          username: true,
          picture: true,
          profileUrl: true,
          bio: true,
          followersCount: true,
          followingCount: true,
          followedAt: true,
          accountCreatedAt: true,
          noteCount: true,
        },
      });

      return {
        items: rows.slice(0, query.limit),
        hasMore: rows.length > query.limit,
      };
    });
  }

  async getFollowerNoteCounts(
    organizationId: string,
    integrationId: string,
    externalIds: string[]
  ): Promise<Map<string, number>> {
    const uniqueIds = [...new Set(externalIds.filter(Boolean))];
    if (!uniqueIds.length) {
      return new Map();
    }

    const rows = await this._dailyAggregate.model.channelAudienceMember.findMany({
      where: {
        organizationId,
        integrationId,
        externalId: { in: uniqueIds },
      },
      select: {
        externalId: true,
        noteCount: true,
      },
    });

    return new Map(rows.map((row) => [row.externalId, row.noteCount]));
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

  private audienceSearchFilter(
    search?: string
  ): Prisma.ChannelAudienceMemberWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { username: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  private audienceListFilters(
    ...filters: Prisma.ChannelAudienceMemberWhereInput[]
  ): Prisma.ChannelAudienceMemberWhereInput {
    const present = filters.filter((filter) => Object.keys(filter).length > 0);
    if (!present.length) {
      return {};
    }

    return { AND: present };
  }

  private audienceFollowerKeyset(
    cursor: AudienceFollowerCursor | undefined,
    direction: 'asc' | 'desc'
  ): Prisma.ChannelAudienceMemberWhereInput {
    if (!cursor) {
      return {};
    }

    const comparison = direction === 'desc' ? 'lt' : 'gt';
    const field = cursor.sortField;
    const typedValue = this.audienceCursorFieldValue(field, cursor.sortValue);
    const fieldAdvance: Prisma.ChannelAudienceMemberWhereInput =
      typedValue !== null
        ? direction === 'desc'
          ? { [field]: { [comparison]: typedValue } }
          : {
              OR: [
                { [field]: { [comparison]: typedValue } },
                { [field]: null },
              ],
            }
        : direction === 'desc'
          ? { [field]: { not: null } }
          : {};
    const equalBranch: Prisma.ChannelAudienceMemberWhereInput = {
      [field]: typedValue,
      externalId: { [comparison]: cursor.externalId },
    };

    if (!Object.keys(fieldAdvance).length) {
      return equalBranch;
    }

    return {
      OR: [fieldAdvance, equalBranch],
    };
  }

  private audienceCursorFieldValue(
    field: AudienceFollowerSortField,
    value: string | number | null
  ) {
    if (value === null) {
      return null;
    }
    if (field === 'followedAt' || field === 'accountCreatedAt') {
      return new Date(String(value));
    }
    return value;
  }

  private noteCountFollowerKeyset(
    cursor: NoteCountFollowerCursor | undefined,
    direction: 'asc' | 'desc'
  ): Prisma.ChannelAudienceMemberWhereInput {
    if (!cursor) {
      return {};
    }

    const comparison = direction === 'desc' ? 'lt' : 'gt';
    return {
      OR: [
        { noteCount: { [comparison]: cursor.noteCount } },
        {
          noteCount: cursor.noteCount,
          externalId: { [comparison]: cursor.externalId },
        },
      ],
    };
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

  private relationshipDueCutoff(snapshotAt: Date) {
    return new Date(snapshotAt.getTime() - RELATIONSHIP_WINDOW_MS);
  }

  private async assertNoteAccess(
    tx: Prisma.TransactionClient,
    organizationId: string,
    integrationId: string,
    externalId: string,
    authorUserId: string
  ) {
    await this.assertOwnedIntegration(tx, organizationId, integrationId);
    const [member, author] = await Promise.all([
      tx.channelAudienceMember.findFirst({
        where: { organizationId, integrationId, externalId },
        select: { id: true },
      }),
      tx.userOrganization.findFirst({
        where: { organizationId, userId: authorUserId, disabled: false },
        select: { id: true },
      }),
    ]);
    if (!member || !author) {
      throw new Error('Channel audience member does not belong to organization');
    }
  }

  private async getInteractionTrackingInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    integrationId: string
  ) {
    const [followerSync, subscriptions] = await Promise.all([
      tx.channelFollowerSyncState.findFirst({
        where: { organizationId, integrationId },
        select: { activeGeneration: true, status: true, completedAt: true },
      }),
      tx.channelInteractionSubscription.findMany({
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
