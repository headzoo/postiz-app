-- Additive migration: channel interaction webhooks and follower ranking schema.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- CreateEnum
CREATE TYPE "ChannelInteractionKind" AS ENUM ('LIKE', 'REPLY', 'REPOST', 'FOLLOW', 'MENTION');

-- CreateEnum
CREATE TYPE "ChannelInteractionDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "ChannelAudienceMembership" AS ENUM ('FOLLOWER', 'NOT_FOLLOWER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ChannelInteractionWindow" AS ENUM ('WEEK', 'MONTH', 'NINETY_DAY', 'YEAR');

-- CreateEnum
CREATE TYPE "ChannelInteractionTrackingState" AS ENUM ('UNCONFIGURED', 'REMOVING', 'PROVISIONING', 'ACTIVE', 'PARTIAL', 'ERROR');

-- CreateEnum
CREATE TYPE "ChannelFollowerSyncStatus" AS ENUM ('IN_PROGRESS', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "ChannelAudienceMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT,
    "username" TEXT,
    "picture" TEXT,
    "profileUrl" TEXT,
    "bio" TEXT,
    "followersCount" INTEGER,
    "followingCount" INTEGER,
    "membershipState" "ChannelAudienceMembership" NOT NULL DEFAULT 'UNKNOWN',
    "followedAt" TIMESTAMP(3),
    "accountCreatedAt" TIMESTAMP(3),
    "followerSyncGeneration" TEXT,
    "membershipEvidenceGeneration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAudienceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelInteractionEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "providerEventKey" TEXT NOT NULL,
    "counterpartyExternalId" TEXT NOT NULL,
    "kind" "ChannelInteractionKind" NOT NULL,
    "direction" "ChannelInteractionDirection" NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "relatedObjectId" TEXT,
    "metadata" JSONB,
    "normalizationVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelInteractionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelInteractionDailyAggregate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "counterpartyExternalId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "interactionScore" INTEGER NOT NULL DEFAULT 0,
    "lastInteractionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelInteractionDailyAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelInteractionWindowSummary" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "window" "ChannelInteractionWindow" NOT NULL,
    "generation" TEXT NOT NULL,
    "counterpartyExternalId" TEXT NOT NULL,
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "interactionScore" INTEGER NOT NULL DEFAULT 0,
    "lastInteractionAt" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelInteractionWindowSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelInteractionRollupState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "window" "ChannelInteractionWindow" NOT NULL,
    "activeGeneration" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelInteractionRollupState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelInteractionSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "direction" "ChannelInteractionDirection" NOT NULL,
    "remoteIdentifier" TEXT,
    "state" "ChannelInteractionTrackingState" NOT NULL DEFAULT 'UNCONFIGURED',
    "trackingStartedAt" TIMESTAMP(3),
    "failureCategory" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelInteractionSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelFollowerSyncState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "activeGeneration" TEXT,
    "pendingGeneration" TEXT,
    "status" "ChannelFollowerSyncStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelFollowerSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderWebhookEndpoint" (
    "id" TEXT NOT NULL,
    "providerIdentifier" TEXT NOT NULL,
    "callbackIdentity" TEXT NOT NULL,
    "remoteWebhookId" TEXT,
    "state" "ChannelInteractionTrackingState" NOT NULL DEFAULT 'UNCONFIGURED',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelAudienceMember_integrationId_externalId_key" ON "ChannelAudienceMember"("integrationId", "externalId");

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_organizationId_integrationId_membershipState_idx" ON "ChannelAudienceMember"("organizationId", "integrationId", "membershipState");

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_integrationId_followerSyncGeneration_idx" ON "ChannelAudienceMember"("integrationId", "followerSyncGeneration");

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_integrationId_membershipEvidenceGeneration_idx" ON "ChannelAudienceMember"("integrationId", "membershipEvidenceGeneration");

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_integrationId_idx" ON "ChannelAudienceMember"("integrationId");

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_organizationId_idx" ON "ChannelAudienceMember"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelInteractionEvent_integrationId_providerEventKey_key" ON "ChannelInteractionEvent"("integrationId", "providerEventKey");

-- CreateIndex
CREATE INDEX "ChannelInteractionEvent_integrationId_counterpartyExternalId_eventAt_idx" ON "ChannelInteractionEvent"("integrationId", "counterpartyExternalId", "eventAt");

-- CreateIndex
CREATE INDEX "ChannelInteractionEvent_integrationId_kind_direction_eventAt_idx" ON "ChannelInteractionEvent"("integrationId", "kind", "direction", "eventAt");

-- CreateIndex
CREATE INDEX "ChannelInteractionEvent_organizationId_idx" ON "ChannelInteractionEvent"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelInteractionDailyAggregate_integrationId_counterpartyExternalId_day_key" ON "ChannelInteractionDailyAggregate"("integrationId", "counterpartyExternalId", "day");

-- CreateIndex
CREATE INDEX "ChannelInteractionDailyAggregate_integrationId_day_idx" ON "ChannelInteractionDailyAggregate"("integrationId", "day");

-- CreateIndex
CREATE INDEX "ChannelInteractionDailyAggregate_organizationId_idx" ON "ChannelInteractionDailyAggregate"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelInteractionWindowSummary_integrationId_window_generation_counterpartyExternalId_key" ON "ChannelInteractionWindowSummary"("integrationId", "window", "generation", "counterpartyExternalId");

-- CreateIndex
CREATE INDEX "ChannelInteractionWindowSummary_integrationId_window_generation_interactionCount_interactionScore_lastInteractionAt_counterpartyExternalId_idx" ON "ChannelInteractionWindowSummary"("integrationId", "window", "generation", "interactionCount", "interactionScore", "lastInteractionAt", "counterpartyExternalId");

-- CreateIndex
CREATE INDEX "ChannelInteractionWindowSummary_organizationId_idx" ON "ChannelInteractionWindowSummary"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelInteractionRollupState_integrationId_window_key" ON "ChannelInteractionRollupState"("integrationId", "window");

-- CreateIndex
CREATE INDEX "ChannelInteractionRollupState_organizationId_idx" ON "ChannelInteractionRollupState"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelFollowerSyncState_integrationId_key" ON "ChannelFollowerSyncState"("integrationId");

-- CreateIndex
CREATE INDEX "ChannelFollowerSyncState_organizationId_idx" ON "ChannelFollowerSyncState"("organizationId");

-- CreateIndex
CREATE INDEX "ChannelFollowerSyncState_integrationId_pendingGeneration_status_idx" ON "ChannelFollowerSyncState"("integrationId", "pendingGeneration", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelInteractionSubscription_integrationId_eventKey_direction_key" ON "ChannelInteractionSubscription"("integrationId", "eventKey", "direction");

-- CreateIndex
CREATE INDEX "ChannelInteractionSubscription_integrationId_state_idx" ON "ChannelInteractionSubscription"("integrationId", "state");

-- CreateIndex
CREATE INDEX "ChannelInteractionSubscription_organizationId_idx" ON "ChannelInteractionSubscription"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderWebhookEndpoint_providerIdentifier_callbackIdentity_key" ON "ProviderWebhookEndpoint"("providerIdentifier", "callbackIdentity");

-- CreateIndex
CREATE INDEX "ProviderWebhookEndpoint_providerIdentifier_state_idx" ON "ProviderWebhookEndpoint"("providerIdentifier", "state");

-- AddForeignKey
ALTER TABLE "ChannelAudienceMember" ADD CONSTRAINT "ChannelAudienceMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceMember" ADD CONSTRAINT "ChannelAudienceMember_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInteractionEvent" ADD CONSTRAINT "ChannelInteractionEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInteractionEvent" ADD CONSTRAINT "ChannelInteractionEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInteractionDailyAggregate" ADD CONSTRAINT "ChannelInteractionDailyAggregate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInteractionDailyAggregate" ADD CONSTRAINT "ChannelInteractionDailyAggregate_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInteractionWindowSummary" ADD CONSTRAINT "ChannelInteractionWindowSummary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInteractionWindowSummary" ADD CONSTRAINT "ChannelInteractionWindowSummary_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInteractionWindowSummary" ADD CONSTRAINT "ChannelInteractionWindowSummary_integrationId_counterpartyExternalId_fkey" FOREIGN KEY ("integrationId", "counterpartyExternalId") REFERENCES "ChannelAudienceMember"("integrationId", "externalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInteractionRollupState" ADD CONSTRAINT "ChannelInteractionRollupState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInteractionRollupState" ADD CONSTRAINT "ChannelInteractionRollupState_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelFollowerSyncState" ADD CONSTRAINT "ChannelFollowerSyncState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelFollowerSyncState" ADD CONSTRAINT "ChannelFollowerSyncState_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInteractionSubscription" ADD CONSTRAINT "ChannelInteractionSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInteractionSubscription" ADD CONSTRAINT "ChannelInteractionSubscription_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
