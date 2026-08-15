-- Additive migration: custom follower lists scoped to a channel.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- CreateTable
CREATE TABLE "ChannelAudienceList" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAudienceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelAudienceListMember" (
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "counterpartyExternalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelAudienceListMember_pkey" PRIMARY KEY ("listId","counterpartyExternalId")
);

-- CreateIndex
CREATE INDEX "ChannelAudienceList_organizationId_integrationId_deletedAt_idx" ON "ChannelAudienceList"("organizationId", "integrationId", "deletedAt");

-- CreateIndex
CREATE INDEX "ChannelAudienceList_integrationId_deletedAt_idx" ON "ChannelAudienceList"("integrationId", "deletedAt");

-- CreateIndex
CREATE INDEX "ChannelAudienceList_createdByUserId_idx" ON "ChannelAudienceList"("createdByUserId");

-- CreateIndex
CREATE INDEX "ChannelAudienceList_organizationId_idx" ON "ChannelAudienceList"("organizationId");

-- CreateIndex
CREATE INDEX "ChannelAudienceListMember_organizationId_integrationId_list_idx" ON "ChannelAudienceListMember"("organizationId", "integrationId", "listId");

-- CreateIndex
CREATE INDEX "ChannelAudienceListMember_integrationId_counterpartyExterna_idx" ON "ChannelAudienceListMember"("integrationId", "counterpartyExternalId");

-- CreateIndex
CREATE INDEX "ChannelAudienceListMember_organizationId_idx" ON "ChannelAudienceListMember"("organizationId");

-- AddForeignKey
ALTER TABLE "ChannelAudienceList" ADD CONSTRAINT "ChannelAudienceList_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceList" ADD CONSTRAINT "ChannelAudienceList_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceList" ADD CONSTRAINT "ChannelAudienceList_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceListMember" ADD CONSTRAINT "ChannelAudienceListMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceListMember" ADD CONSTRAINT "ChannelAudienceListMember_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceListMember" ADD CONSTRAINT "ChannelAudienceListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ChannelAudienceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceListMember" ADD CONSTRAINT "ChannelAudienceListMember_integrationId_counterpartyExter_fkey" FOREIGN KEY ("integrationId", "counterpartyExternalId") REFERENCES "ChannelAudienceMember"("integrationId", "externalId") ON DELETE RESTRICT ON UPDATE CASCADE;
