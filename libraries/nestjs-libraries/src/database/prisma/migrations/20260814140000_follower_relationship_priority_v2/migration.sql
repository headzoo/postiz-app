-- Additive migration: current relationship snapshot projections for formula v2.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- AlterTable
ALTER TABLE "ChannelAudienceMember"
  ADD COLUMN "relationshipEffortScore" INTEGER,
  ADD COLUMN "relationshipReciprocationScore" INTEGER,
  ADD COLUMN "relationshipNetGap" INTEGER,
  ADD COLUMN "relationshipTriage" TEXT,
  ADD COLUMN "relationshipFormulaVersion" INTEGER,
  ADD COLUMN "relationshipSnapshotAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_rel_effort_keyset_idx"
  ON "ChannelAudienceMember"("integrationId", "membershipState", "relationshipEffortScore", "externalId");
CREATE INDEX "ChannelAudienceMember_rel_reciprocation_keyset_idx"
  ON "ChannelAudienceMember"("integrationId", "membershipState", "relationshipReciprocationScore", "externalId");
CREATE INDEX "ChannelAudienceMember_rel_net_gap_keyset_idx"
  ON "ChannelAudienceMember"("integrationId", "membershipState", "relationshipNetGap", "externalId");
CREATE INDEX "ChannelAudienceMember_rel_triage_keyset_idx"
  ON "ChannelAudienceMember"("integrationId", "membershipState", "relationshipTriage", "externalId");
CREATE INDEX "ChannelAudienceMember_rel_formula_due_idx"
  ON "ChannelAudienceMember"("integrationId", "membershipState", "relationshipFormulaVersion", "relationshipSnapshotAt");

-- Backfill projections from each member's latest immutable snapshot.
UPDATE "ChannelAudienceMember" AS member
SET
  "relationshipGrade" = snapshot."grade",
  "relationshipEffortScore" = snapshot."effortScore",
  "relationshipReciprocationScore" = snapshot."reciprocationScore",
  "relationshipNetGap" = snapshot."reciprocationScore" - snapshot."effortScore",
  -- Mirrors getRelationshipTriage: quiet takes precedence, followed by the
  -- directional 1.5 ratio checks, with all remaining active relationships mutual.
  "relationshipTriage" = CASE
    WHEN GREATEST(snapshot."effortScore", snapshot."reciprocationScore") < 8
      THEN 'quiet'
    WHEN snapshot."reciprocationScore" >= 8
      AND (
        snapshot."effortScore" = 0
        OR snapshot."reciprocationScore"::BIGINT * 2
          >= snapshot."effortScore"::BIGINT * 3
      )
      THEN 'hot_lead'
    WHEN snapshot."effortScore" >= 8
      AND (
        snapshot."reciprocationScore" = 0
        OR snapshot."effortScore"::BIGINT * 2
          >= snapshot."reciprocationScore"::BIGINT * 3
      )
      THEN 'over_invested'
    ELSE 'mutual'
  END,
  "relationshipFormulaVersion" = snapshot."formulaVersion",
  "relationshipSnapshotAt" = snapshot."snapshotAt"
FROM (
  SELECT DISTINCT ON ("integrationId", "counterpartyExternalId")
    "integrationId",
    "counterpartyExternalId",
    "effortScore",
    "reciprocationScore",
    "grade",
    "formulaVersion",
    "snapshotAt"
  FROM "ChannelRelationshipGradeSnapshot"
  ORDER BY "integrationId", "counterpartyExternalId", "snapshotAt" DESC
) AS snapshot
WHERE member."integrationId" = snapshot."integrationId"
  AND member."externalId" = snapshot."counterpartyExternalId";
