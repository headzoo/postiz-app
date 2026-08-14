-- Additive migration: denormalized inbound interaction counts for the Lead list.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- AlterTable
ALTER TABLE "ChannelAudienceMember" ADD COLUMN "inboundInteractionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ChannelAudienceMember" ADD COLUMN "lastInboundAt" TIMESTAMP(3);

-- Backfill from existing inbound events
UPDATE "ChannelAudienceMember" AS member
SET
  "inboundInteractionCount" = counts.inbound_count,
  "lastInboundAt" = counts.last_inbound_at
FROM (
  SELECT
    "integrationId",
    "counterpartyExternalId",
    COUNT(*)::INTEGER AS inbound_count,
    MAX("eventAt") AS last_inbound_at
  FROM "ChannelInteractionEvent"
  WHERE "direction" = 'INBOUND'
  GROUP BY "integrationId", "counterpartyExternalId"
) AS counts
WHERE member."integrationId" = counts."integrationId"
  AND member."externalId" = counts."counterpartyExternalId";

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_lead_inbound_keyset_idx"
ON "ChannelAudienceMember"("integrationId", "membershipState", "lastInboundAt", "externalId");
