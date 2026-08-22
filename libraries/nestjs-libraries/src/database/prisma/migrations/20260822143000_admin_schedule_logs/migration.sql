-- Additive migration: operational log lines for admin Temporal schedules.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- CreateEnum
CREATE TYPE "AdminScheduleLogKey" AS ENUM (
  'RELATIONSHIP_GRADES',
  'FOLLOWER_BOT_SCORES',
  'LEAD_BRIDGE',
  'MISSING_POST_RECOVERY',
  'POST_WORKFLOWS',
  'AUTOPOST_WORKFLOWS'
);

-- CreateEnum
CREATE TYPE "AdminScheduleLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "AdminScheduleLog" (
    "id" TEXT NOT NULL,
    "scheduleKey" "AdminScheduleLogKey" NOT NULL,
    "level" "AdminScheduleLogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminScheduleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminScheduleLog_scheduleKey_createdAt_idx" ON "AdminScheduleLog"("scheduleKey", "createdAt");
