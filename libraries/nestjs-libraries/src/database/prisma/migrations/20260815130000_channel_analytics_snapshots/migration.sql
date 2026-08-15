-- Additive durable channel analytics storage.
CREATE TYPE "ChannelAnalyticsValueMode" AS ENUM ('SUM', 'AVERAGE', 'LATEST');
CREATE TYPE "ChannelAnalyticsDisplayUnit" AS ENUM ('COUNT', 'PERCENTAGE', 'DURATION', 'DECIMAL');

CREATE TABLE "ChannelAnalyticsDailyPoint" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "metricKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "valueMode" "ChannelAnalyticsValueMode" NOT NULL,
  "displayUnit" "ChannelAnalyticsDisplayUnit",
  "value" DECIMAL(30,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelAnalyticsDailyPoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelAnalyticsPostMetricSnapshot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "snapshotAt" TIMESTAMP(3) NOT NULL,
  "externalPostId" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "valueMode" "ChannelAnalyticsValueMode" NOT NULL,
  "displayUnit" "ChannelAnalyticsDisplayUnit",
  "value" DECIMAL(30,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelAnalyticsPostMetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelAnalyticsSyncState" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "lastSuccessfulSnapshotAt" TIMESTAMP(3),
  "lastCoveredDay" DATE,
  "coverageStartDay" DATE,
  "coverageEndDay" DATE,
  "pendingCoverageSnapshotAt" TIMESTAMP(3),
  "pendingCoverageStartDay" DATE,
  "pendingCoverageEndDay" DATE,
  "nextAttemptAt" TIMESTAMP(3),
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "failureCategory" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelAnalyticsSyncState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChannelAnalyticsDailyPoint_integrationId_day_metricKey_key"
  ON "ChannelAnalyticsDailyPoint"("integrationId", "day", "metricKey");
CREATE INDEX "ChannelAnalyticsDailyPoint_organizationId_integrationId_day_idx"
  ON "ChannelAnalyticsDailyPoint"("organizationId", "integrationId", "day");
CREATE INDEX "ChannelAnalyticsDailyPoint_integrationId_day_idx"
  ON "ChannelAnalyticsDailyPoint"("integrationId", "day");
CREATE UNIQUE INDEX "ChannelAnalyticsPostMetricSnapshot_integrationId_snapshotAt_externalPostId_metricKey_key"
  ON "ChannelAnalyticsPostMetricSnapshot"("integrationId", "snapshotAt", "externalPostId", "metricKey");
CREATE INDEX "ChannelAnalyticsPostMetricSnapshot_organizationId_integrationId_snapshotAt_idx"
  ON "ChannelAnalyticsPostMetricSnapshot"("organizationId", "integrationId", "snapshotAt");
CREATE INDEX "ChannelAnalyticsPostMetricSnapshot_integrationId_snapshotAt_idx"
  ON "ChannelAnalyticsPostMetricSnapshot"("integrationId", "snapshotAt");
CREATE UNIQUE INDEX "ChannelAnalyticsSyncState_integrationId_key"
  ON "ChannelAnalyticsSyncState"("integrationId");
CREATE INDEX "ChannelAnalyticsSyncState_nextAttemptAt_integrationId_idx"
  ON "ChannelAnalyticsSyncState"("nextAttemptAt", "integrationId");
CREATE INDEX "ChannelAnalyticsSyncState_organizationId_idx"
  ON "ChannelAnalyticsSyncState"("organizationId");

ALTER TABLE "ChannelAnalyticsDailyPoint" ADD CONSTRAINT "ChannelAnalyticsDailyPoint_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannelAnalyticsDailyPoint" ADD CONSTRAINT "ChannelAnalyticsDailyPoint_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannelAnalyticsPostMetricSnapshot" ADD CONSTRAINT "ChannelAnalyticsPostMetricSnapshot_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannelAnalyticsPostMetricSnapshot" ADD CONSTRAINT "ChannelAnalyticsPostMetricSnapshot_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannelAnalyticsSyncState" ADD CONSTRAINT "ChannelAnalyticsSyncState_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannelAnalyticsSyncState" ADD CONSTRAINT "ChannelAnalyticsSyncState_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
