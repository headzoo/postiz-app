-- Additive migration: channel context document assignments + lead fit scoring fields.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- AlterTable
ALTER TABLE "ChannelAudienceMember" ADD COLUMN     "leadFitScore" DOUBLE PRECISION,
ADD COLUMN     "leadFitReason" TEXT,
ADD COLUMN     "leadFitConcerns" TEXT,
ADD COLUMN     "leadFitMatchedTopics" TEXT,
ADD COLUMN     "leadFitModel" TEXT,
ADD COLUMN     "leadFitVersion" INTEGER,
ADD COLUMN     "leadFitScoredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_lead_fit_keyset_idx" ON "ChannelAudienceMember"("integrationId", "membershipState", "leadFitScore", "leadBridgeScore", "lastInboundAt", "externalId");

-- CreateTable
CREATE TABLE "IntegrationContextDocument" (
    "integrationId" TEXT NOT NULL,
    "contextDocumentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationContextDocument_pkey" PRIMARY KEY ("integrationId","contextDocumentId")
);

-- CreateIndex
CREATE INDEX "IntegrationContextDocument_contextDocumentId_integrationId_idx" ON "IntegrationContextDocument"("contextDocumentId", "integrationId");

-- AddForeignKey
ALTER TABLE "IntegrationContextDocument" ADD CONSTRAINT "IntegrationContextDocument_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationContextDocument" ADD CONSTRAINT "IntegrationContextDocument_contextDocumentId_fkey" FOREIGN KEY ("contextDocumentId") REFERENCES "ContextDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
