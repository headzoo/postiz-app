-- Additive migration: current computed relationship grade on audience members.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- AlterTable
ALTER TABLE "ChannelAudienceMember" ADD COLUMN "relationshipGrade" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_integrationId_membershipState_relati_idx" ON "ChannelAudienceMember"("integrationId", "membershipState", "relationshipGrade", "externalId");

-- Backfill current grade from the latest snapshot per member.
UPDATE "ChannelAudienceMember" AS member
SET "relationshipGrade" = snapshot."grade"
FROM (
  SELECT DISTINCT ON ("integrationId", "counterpartyExternalId")
    "integrationId",
    "counterpartyExternalId",
    "grade"
  FROM "ChannelRelationshipGradeSnapshot"
  ORDER BY "integrationId", "counterpartyExternalId", "snapshotAt" DESC
) AS snapshot
WHERE member."integrationId" = snapshot."integrationId"
  AND member."externalId" = snapshot."counterpartyExternalId";
