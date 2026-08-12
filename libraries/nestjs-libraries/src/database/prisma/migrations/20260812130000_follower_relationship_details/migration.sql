-- Additive migration: follower relationship notes and grade snapshots.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- CreateTable
CREATE TABLE "ChannelAudienceNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "counterpartyExternalId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAudienceNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelRelationshipGradeSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "counterpartyExternalId" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "effortScore" INTEGER NOT NULL,
    "reciprocationScore" INTEGER NOT NULL,
    "reciprocity" DOUBLE PRECISION,
    "grade" DOUBLE PRECISION,
    "formulaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelRelationshipGradeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelAudienceNote_organizationId_integrationId_counterpar_idx" ON "ChannelAudienceNote"("organizationId", "integrationId", "counterpartyExternalId", "createdAt");

-- CreateIndex
CREATE INDEX "ChannelAudienceNote_integrationId_counterpartyExternalId_cr_idx" ON "ChannelAudienceNote"("integrationId", "counterpartyExternalId", "createdAt");

-- CreateIndex
CREATE INDEX "ChannelAudienceNote_authorUserId_idx" ON "ChannelAudienceNote"("authorUserId");

-- CreateIndex
CREATE INDEX "ChannelAudienceNote_organizationId_idx" ON "ChannelAudienceNote"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelRelationshipGradeSnapshot_integrationId_counterparty_key" ON "ChannelRelationshipGradeSnapshot"("integrationId", "counterpartyExternalId", "snapshotAt");

-- CreateIndex
CREATE INDEX "ChannelRelationshipGradeSnapshot_integrationId_counterparty_idx" ON "ChannelRelationshipGradeSnapshot"("integrationId", "counterpartyExternalId", "snapshotAt");

-- CreateIndex
CREATE INDEX "ChannelRelationshipGradeSnapshot_integrationId_snapshotAt_idx" ON "ChannelRelationshipGradeSnapshot"("integrationId", "snapshotAt");

-- CreateIndex
CREATE INDEX "ChannelRelationshipGradeSnapshot_organizationId_idx" ON "ChannelRelationshipGradeSnapshot"("organizationId");

-- AddForeignKey
ALTER TABLE "ChannelAudienceNote" ADD CONSTRAINT "ChannelAudienceNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceNote" ADD CONSTRAINT "ChannelAudienceNote_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceNote" ADD CONSTRAINT "ChannelAudienceNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceNote" ADD CONSTRAINT "ChannelAudienceNote_integrationId_counterpartyExternalId_fkey" FOREIGN KEY ("integrationId", "counterpartyExternalId") REFERENCES "ChannelAudienceMember"("integrationId", "externalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelRelationshipGradeSnapshot" ADD CONSTRAINT "ChannelRelationshipGradeSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelRelationshipGradeSnapshot" ADD CONSTRAINT "ChannelRelationshipGradeSnapshot_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelRelationshipGradeSnapshot" ADD CONSTRAINT "ChannelRelationshipGradeSnapshot_integrationId_counterparty_fkey" FOREIGN KEY ("integrationId", "counterpartyExternalId") REFERENCES "ChannelAudienceMember"("integrationId", "externalId") ON DELETE RESTRICT ON UPDATE CASCADE;
