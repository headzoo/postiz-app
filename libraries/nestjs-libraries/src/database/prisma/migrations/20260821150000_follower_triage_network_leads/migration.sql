-- Additive migration: lastOutboundAt, triage ignore expiry, network lead bridges.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- AlterTable
ALTER TABLE "ChannelAudienceMember" ADD COLUMN "lastOutboundAt" TIMESTAMP(3);
ALTER TABLE "ChannelAudienceMember" ADD COLUMN "leadBridgeScore" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_lead_bridge_keyset_idx" ON "ChannelAudienceMember"("integrationId", "membershipState", "leadBridgeScore", "lastInboundAt", "externalId");

-- AlterTable
ALTER TABLE "ChannelAudienceMemberTriageIgnore" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ChannelAudienceMemberTriageIgnore_expiresAt_idx" ON "ChannelAudienceMemberTriageIgnore"("expiresAt");

-- CreateTable
CREATE TABLE "ChannelAudienceLeadBridge" (
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "leadExternalId" TEXT NOT NULL,
    "bridgeExternalId" TEXT NOT NULL,
    "bridgeRelationshipGrade" DOUBLE PRECISION,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelAudienceLeadBridge_pkey" PRIMARY KEY ("organizationId","integrationId","leadExternalId","bridgeExternalId")
);

-- CreateIndex
CREATE INDEX "ChannelAudienceLeadBridge_integrationId_leadExternalId_idx" ON "ChannelAudienceLeadBridge"("integrationId", "leadExternalId");

-- CreateIndex
CREATE INDEX "ChannelAudienceLeadBridge_integrationId_bridgeExternalId_idx" ON "ChannelAudienceLeadBridge"("integrationId", "bridgeExternalId");

-- CreateIndex
CREATE INDEX "ChannelAudienceLeadBridge_organizationId_idx" ON "ChannelAudienceLeadBridge"("organizationId");

-- AddForeignKey
ALTER TABLE "ChannelAudienceLeadBridge" ADD CONSTRAINT "ChannelAudienceLeadBridge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceLeadBridge" ADD CONSTRAINT "ChannelAudienceLeadBridge_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceLeadBridge" ADD CONSTRAINT "ChannelAudienceLeadBridge_integrationId_leadExternalId_fkey" FOREIGN KEY ("integrationId", "leadExternalId") REFERENCES "ChannelAudienceMember"("integrationId", "externalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceLeadBridge" ADD CONSTRAINT "ChannelAudienceLeadBridge_integrationId_bridgeExternalId_fkey" FOREIGN KEY ("integrationId", "bridgeExternalId") REFERENCES "ChannelAudienceMember"("integrationId", "externalId") ON DELETE RESTRICT ON UPDATE CASCADE;
