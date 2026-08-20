-- Additive migration: provider-neutral follower bot grade projection.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- AlterTable
ALTER TABLE "ChannelAudienceMember"
  ADD COLUMN "botGrade" INTEGER,
  ADD COLUMN "isBot" BOOLEAN,
  ADD COLUMN "botConfidence" DOUBLE PRECISION,
  ADD COLUMN "botFormulaVersion" INTEGER,
  ADD COLUMN "botGradedAt" TIMESTAMP(3);

-- CheckConstraints
ALTER TABLE "ChannelAudienceMember"
  ADD CONSTRAINT "ChannelAudienceMember_botGrade_check"
  CHECK ("botGrade" IS NULL OR ("botGrade" >= 1 AND "botGrade" <= 5));

ALTER TABLE "ChannelAudienceMember"
  ADD CONSTRAINT "ChannelAudienceMember_botConfidence_check"
  CHECK (
    "botConfidence" IS NULL
    OR ("botConfidence" >= 0 AND "botConfidence" <= 1)
  );

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_bot_grade_keyset_idx"
  ON "ChannelAudienceMember"("integrationId", "membershipState", "botGrade", "externalId");
CREATE INDEX "ChannelAudienceMember_is_bot_keyset_idx"
  ON "ChannelAudienceMember"("integrationId", "membershipState", "isBot", "externalId");
CREATE INDEX "ChannelAudienceMember_bot_formula_due_idx"
  ON "ChannelAudienceMember"("integrationId", "membershipState", "botFormulaVersion", "botGradedAt");
