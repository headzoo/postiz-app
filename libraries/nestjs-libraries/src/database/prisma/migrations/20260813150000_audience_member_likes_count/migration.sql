-- Additive migration: denormalized inbound like count for follower like sorting.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- AlterTable
ALTER TABLE "ChannelAudienceMember" ADD COLUMN "likesCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing inbound like events
UPDATE "ChannelAudienceMember" AS member
SET "likesCount" = counts.likes_count
FROM (
  SELECT
    "integrationId",
    "counterpartyExternalId",
    COUNT(*)::INTEGER AS likes_count
  FROM "ChannelInteractionEvent"
  WHERE "kind" = 'LIKE'
    AND "direction" = 'INBOUND'
  GROUP BY "integrationId", "counterpartyExternalId"
) AS counts
WHERE member."integrationId" = counts."integrationId"
  AND member."externalId" = counts."counterpartyExternalId";

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_integrationId_membershipState_likesCo_idx"
ON "ChannelAudienceMember"("integrationId", "membershipState", "likesCount", "externalId");
