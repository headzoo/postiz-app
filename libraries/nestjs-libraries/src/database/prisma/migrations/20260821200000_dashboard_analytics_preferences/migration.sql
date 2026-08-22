-- CreateTable
CREATE TABLE "DashboardAnalyticsPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardAnalyticsPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DashboardAnalyticsPreference_userId_organizationId_idx" ON "DashboardAnalyticsPreference"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "DashboardAnalyticsPreference_organizationId_integrationId_idx" ON "DashboardAnalyticsPreference"("organizationId", "integrationId");

-- CreateIndex
CREATE INDEX "DashboardAnalyticsPreference_integrationId_idx" ON "DashboardAnalyticsPreference"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardAnalyticsPreference_userId_organizationId_integrationId_metricKey_key" ON "DashboardAnalyticsPreference"("userId", "organizationId", "integrationId", "metricKey");

-- AddForeignKey
ALTER TABLE "DashboardAnalyticsPreference" ADD CONSTRAINT "DashboardAnalyticsPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardAnalyticsPreference" ADD CONSTRAINT "DashboardAnalyticsPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardAnalyticsPreference" ADD CONSTRAINT "DashboardAnalyticsPreference_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
