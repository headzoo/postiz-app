-- Additive migration: HTTP request/response logs for posts and webhooks.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- CreateEnum
CREATE TYPE "WebhookHttpLogDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "WebhookHttpLogSource" AS ENUM ('ORG_WEBHOOK', 'CHANNEL_WEBHOOK', 'TEST');

-- CreateTable
CREATE TABLE "PostHttpLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "postId" TEXT,
    "integrationId" TEXT,
    "provider" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "statusCode" INTEGER,
    "requestHeaders" TEXT NOT NULL DEFAULT '{}',
    "requestBody" TEXT NOT NULL DEFAULT '',
    "responseHeaders" TEXT NOT NULL DEFAULT '{}',
    "responseBody" TEXT NOT NULL DEFAULT '',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostHttpLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookHttpLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "webhookId" TEXT,
    "integrationId" TEXT,
    "direction" "WebhookHttpLogDirection" NOT NULL,
    "source" "WebhookHttpLogSource" NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "statusCode" INTEGER,
    "requestHeaders" TEXT NOT NULL DEFAULT '{}',
    "requestBody" TEXT NOT NULL DEFAULT '',
    "responseHeaders" TEXT NOT NULL DEFAULT '{}',
    "responseBody" TEXT NOT NULL DEFAULT '',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookHttpLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostHttpLog_organizationId_createdAt_idx" ON "PostHttpLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "PostHttpLog_postId_idx" ON "PostHttpLog"("postId");

-- CreateIndex
CREATE INDEX "WebhookHttpLog_organizationId_createdAt_idx" ON "WebhookHttpLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookHttpLog_webhookId_idx" ON "WebhookHttpLog"("webhookId");

-- CreateIndex
CREATE INDEX "WebhookHttpLog_direction_idx" ON "WebhookHttpLog"("direction");

-- AddForeignKey
ALTER TABLE "PostHttpLog" ADD CONSTRAINT "PostHttpLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostHttpLog" ADD CONSTRAINT "PostHttpLog_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostHttpLog" ADD CONSTRAINT "PostHttpLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookHttpLog" ADD CONSTRAINT "WebhookHttpLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookHttpLog" ADD CONSTRAINT "WebhookHttpLog_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookHttpLog" ADD CONSTRAINT "WebhookHttpLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
