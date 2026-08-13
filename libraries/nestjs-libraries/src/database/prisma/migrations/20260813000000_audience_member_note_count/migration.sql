-- Additive migration: denormalized note count for follower note sorting.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- AlterTable
ALTER TABLE "ChannelAudienceMember" ADD COLUMN "noteCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing notes
UPDATE "ChannelAudienceMember" AS member
SET "noteCount" = counts.note_count
FROM (
  SELECT
    "integrationId",
    "counterpartyExternalId",
    COUNT(*)::INTEGER AS note_count
  FROM "ChannelAudienceNote"
  GROUP BY "integrationId", "counterpartyExternalId"
) AS counts
WHERE member."integrationId" = counts."integrationId"
  AND member."externalId" = counts."counterpartyExternalId";

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_integrationId_membershipState_noteCou_idx"
ON "ChannelAudienceMember"("integrationId", "membershipState", "noteCount", "externalId");
