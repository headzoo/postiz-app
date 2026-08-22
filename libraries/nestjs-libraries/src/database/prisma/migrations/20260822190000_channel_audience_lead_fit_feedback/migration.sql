-- Additive migration: human lead-fit feedback (dismiss negatives + list-add positives).
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- CreateTable
CREATE TABLE "ChannelAudienceLeadFitFeedback" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "counterpartyExternalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "reasons" TEXT,
    "name" TEXT,
    "username" TEXT,
    "bio" TEXT,
    "followersCount" INTEGER,
    "followingCount" INTEGER,
    "leadFitScore" DOUBLE PRECISION,
    "leadFitReason" TEXT,
    "leadFitMatchedTopics" TEXT,
    "listId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAudienceLeadFitFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelAudienceLeadFitFeedback_organizationId_integrationId_counterpartyExternalId_source_key" ON "ChannelAudienceLeadFitFeedback"("organizationId", "integrationId", "counterpartyExternalId", "source");

-- CreateIndex
CREATE INDEX "ChannelAudienceLeadFitFeedback_organizationId_integrationId_verdict_updatedAt_idx" ON "ChannelAudienceLeadFitFeedback"("organizationId", "integrationId", "verdict", "updatedAt");

-- CreateIndex
CREATE INDEX "ChannelAudienceLeadFitFeedback_integrationId_counterpartyExternalId_idx" ON "ChannelAudienceLeadFitFeedback"("integrationId", "counterpartyExternalId");

-- CreateIndex
CREATE INDEX "ChannelAudienceLeadFitFeedback_createdByUserId_idx" ON "ChannelAudienceLeadFitFeedback"("createdByUserId");

-- CreateIndex
CREATE INDEX "ChannelAudienceLeadFitFeedback_organizationId_idx" ON "ChannelAudienceLeadFitFeedback"("organizationId");

-- AddForeignKey
ALTER TABLE "ChannelAudienceLeadFitFeedback" ADD CONSTRAINT "ChannelAudienceLeadFitFeedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceLeadFitFeedback" ADD CONSTRAINT "ChannelAudienceLeadFitFeedback_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceLeadFitFeedback" ADD CONSTRAINT "ChannelAudienceLeadFitFeedback_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceLeadFitFeedback" ADD CONSTRAINT "ChannelAudienceLeadFitFeedback_integrationId_counterpartyExternalId_fkey" FOREIGN KEY ("integrationId", "counterpartyExternalId") REFERENCES "ChannelAudienceMember"("integrationId", "externalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill accepted feedback from existing list memberships (one row per member).
INSERT INTO "ChannelAudienceLeadFitFeedback" (
    "id",
    "organizationId",
    "integrationId",
    "counterpartyExternalId",
    "source",
    "verdict",
    "reasons",
    "name",
    "username",
    "bio",
    "followersCount",
    "followingCount",
    "leadFitScore",
    "leadFitReason",
    "leadFitMatchedTopics",
    "listId",
    "createdByUserId",
    "createdAt",
    "updatedAt"
)
SELECT
    md5(lm."organizationId" || ':' || lm."integrationId" || ':' || lm."counterpartyExternalId" || ':list_add'),
    lm."organizationId",
    lm."integrationId",
    lm."counterpartyExternalId",
    'list_add',
    'accepted',
    '[]',
    m."name",
    m."username",
    m."bio",
    m."followersCount",
    m."followingCount",
    m."leadFitScore",
    m."leadFitReason",
    m."leadFitMatchedTopics",
    (
        SELECT lm2."listId"
        FROM "ChannelAudienceListMember" lm2
        WHERE lm2."organizationId" = lm."organizationId"
          AND lm2."integrationId" = lm."integrationId"
          AND lm2."counterpartyExternalId" = lm."counterpartyExternalId"
        ORDER BY lm2."createdAt" ASC
        LIMIT 1
    ),
    NULL,
    MIN(lm."createdAt"),
    NOW()
FROM "ChannelAudienceListMember" lm
INNER JOIN "ChannelAudienceMember" m
    ON m."integrationId" = lm."integrationId"
   AND m."externalId" = lm."counterpartyExternalId"
GROUP BY
    lm."organizationId",
    lm."integrationId",
    lm."counterpartyExternalId",
    m."name",
    m."username",
    m."bio",
    m."followersCount",
    m."followingCount",
    m."leadFitScore",
    m."leadFitReason",
    m."leadFitMatchedTopics"
ON CONFLICT ("organizationId", "integrationId", "counterpartyExternalId", "source") DO NOTHING;

-- Backfill rejected feedback from active lead triage ignores (reasons empty; bio still trains).
INSERT INTO "ChannelAudienceLeadFitFeedback" (
    "id",
    "organizationId",
    "integrationId",
    "counterpartyExternalId",
    "source",
    "verdict",
    "reasons",
    "name",
    "username",
    "bio",
    "followersCount",
    "followingCount",
    "leadFitScore",
    "leadFitReason",
    "leadFitMatchedTopics",
    "listId",
    "createdByUserId",
    "createdAt",
    "updatedAt"
)
SELECT
    md5(ti."organizationId" || ':' || ti."integrationId" || ':' || ti."counterpartyExternalId" || ':lead_dismiss'),
    ti."organizationId",
    ti."integrationId",
    ti."counterpartyExternalId",
    'lead_dismiss',
    'rejected',
    '[]',
    m."name",
    m."username",
    m."bio",
    m."followersCount",
    m."followingCount",
    m."leadFitScore",
    m."leadFitReason",
    m."leadFitMatchedTopics",
    NULL,
    ti."createdByUserId",
    ti."createdAt",
    NOW()
FROM "ChannelAudienceMemberTriageIgnore" ti
INNER JOIN "ChannelAudienceMember" m
    ON m."integrationId" = ti."integrationId"
   AND m."externalId" = ti."counterpartyExternalId"
WHERE ti."triage" = 'lead'
  AND (ti."expiresAt" IS NULL OR ti."expiresAt" > NOW())
ON CONFLICT ("organizationId", "integrationId", "counterpartyExternalId", "source") DO NOTHING;
