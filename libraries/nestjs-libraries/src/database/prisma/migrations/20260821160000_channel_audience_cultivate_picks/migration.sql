-- Additive migration: Cultivate daily picks + lastOutbound keyset index.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_last_outbound_keyset_idx" ON "ChannelAudienceMember"("integrationId", "membershipState", "lastOutboundAt", "externalId");

-- CreateTable
CREATE TABLE "ChannelAudienceCultivatePick" (
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "counterpartyExternalId" TEXT NOT NULL,
    "rulesRank" INTEGER NOT NULL,
    "finalRank" INTEGER NOT NULL,
    "rulesReason" TEXT NOT NULL,
    "aiRank" INTEGER,
    "aiReason" TEXT,
    "suggestedAction" TEXT,
    "source" TEXT NOT NULL DEFAULT 'rules',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAudienceCultivatePick_pkey" PRIMARY KEY ("organizationId","integrationId","day","counterpartyExternalId")
);

-- CreateIndex
CREATE INDEX "ChannelAudienceCultivatePick_integrationId_day_finalRank_idx" ON "ChannelAudienceCultivatePick"("integrationId", "day", "finalRank");

-- CreateIndex
CREATE INDEX "ChannelAudienceCultivatePick_organizationId_integrationId_day_idx" ON "ChannelAudienceCultivatePick"("organizationId", "integrationId", "day");

-- CreateIndex
CREATE INDEX "ChannelAudienceCultivatePick_organizationId_idx" ON "ChannelAudienceCultivatePick"("organizationId");

-- AddForeignKey
ALTER TABLE "ChannelAudienceCultivatePick" ADD CONSTRAINT "ChannelAudienceCultivatePick_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceCultivatePick" ADD CONSTRAINT "ChannelAudienceCultivatePick_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceCultivatePick" ADD CONSTRAINT "ChannelAudienceCultivatePick_integrationId_counterpartyExte_fkey" FOREIGN KEY ("integrationId", "counterpartyExternalId") REFERENCES "ChannelAudienceMember"("integrationId", "externalId") ON DELETE RESTRICT ON UPDATE CASCADE;
