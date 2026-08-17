-- Additive migration: org-scoped triage badge ignores for auto-computed relationship triage.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- CreateTable
CREATE TABLE "ChannelAudienceMemberTriageIgnore" (
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "counterpartyExternalId" TEXT NOT NULL,
    "triage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "ChannelAudienceMemberTriageIgnore_pkey" PRIMARY KEY ("organizationId","integrationId","counterpartyExternalId","triage")
);

-- CreateIndex
CREATE INDEX "ChannelAudienceMemberTriageIgnore_organizationId_integratio_idx" ON "ChannelAudienceMemberTriageIgnore"("organizationId", "integrationId", "triage");

-- CreateIndex
CREATE INDEX "ChannelAudienceMemberTriageIgnore_integrationId_counterpart_idx" ON "ChannelAudienceMemberTriageIgnore"("integrationId", "counterpartyExternalId");

-- CreateIndex
CREATE INDEX "ChannelAudienceMemberTriageIgnore_createdByUserId_idx" ON "ChannelAudienceMemberTriageIgnore"("createdByUserId");

-- CreateIndex
CREATE INDEX "ChannelAudienceMemberTriageIgnore_organizationId_idx" ON "ChannelAudienceMemberTriageIgnore"("organizationId");

-- AddForeignKey
ALTER TABLE "ChannelAudienceMemberTriageIgnore" ADD CONSTRAINT "ChannelAudienceMemberTriageIgnore_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceMemberTriageIgnore" ADD CONSTRAINT "ChannelAudienceMemberTriageIgnore_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceMemberTriageIgnore" ADD CONSTRAINT "ChannelAudienceMemberTriageIgnore_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceMemberTriageIgnore" ADD CONSTRAINT "ChannelAudienceMemberTriageIgnore_integrationId_counterpar_fkey" FOREIGN KEY ("integrationId", "counterpartyExternalId") REFERENCES "ChannelAudienceMember"("integrationId", "externalId") ON DELETE RESTRICT ON UPDATE CASCADE;
