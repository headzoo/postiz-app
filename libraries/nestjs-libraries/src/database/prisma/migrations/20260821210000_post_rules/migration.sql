-- CreateEnum
CREATE TYPE "PostRuleAction" AS ENUM ('REMOVE', 'AUTO_REPOST', 'AUTO_PLUG');

-- CreateEnum
CREATE TYPE "PostRuleConditionMatch" AS ENUM ('ANY', 'ALL');

-- CreateEnum
CREATE TYPE "PostRuleConditionMetric" AS ENUM ('LIKES', 'REPLIES');

-- CreateEnum
CREATE TYPE "PostRuleConditionOperator" AS ENUM ('LT', 'LTE', 'GT', 'GTE');

-- CreateEnum
CREATE TYPE "PostRuleRescheduleMode" AS ENUM ('MANUAL', 'PIPELINE');

-- CreateEnum
CREATE TYPE "PostRuleRunStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PostRuleEvaluationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "PostRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "action" "PostRuleAction" NOT NULL,
    "initialDelayHours" INTEGER NOT NULL,
    "evaluationIntervalHours" INTEGER,
    "maxEvaluations" INTEGER,
    "conditionMatch" "PostRuleConditionMatch" NOT NULL DEFAULT 'ANY',
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actionConfig" JSONB NOT NULL DEFAULT '{}',
    "rescheduleConfig" JSONB,
    "maxRescheduleAttempts" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostRuleIntegration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostRuleIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostRulePipeline" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostRulePipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostRuleRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ruleId" TEXT,
    "postId" TEXT NOT NULL,
    "lineageId" TEXT NOT NULL,
    "rescheduleAttempt" INTEGER NOT NULL DEFAULT 0,
    "status" "PostRuleRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostRuleRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostRuleEvaluation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "evaluationIndex" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "PostRuleEvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metrics" JSONB,
    "actionResult" JSONB,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostRuleEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostRule_organizationId_enabled_idx" ON "PostRule"("organizationId", "enabled");

-- CreateIndex
CREATE INDEX "PostRule_organizationId_action_idx" ON "PostRule"("organizationId", "action");

-- CreateIndex
CREATE INDEX "PostRule_organizationId_idx" ON "PostRule"("organizationId");

-- CreateIndex
CREATE INDEX "PostRuleIntegration_organizationId_integrationId_idx" ON "PostRuleIntegration"("organizationId", "integrationId");

-- CreateIndex
CREATE INDEX "PostRuleIntegration_integrationId_idx" ON "PostRuleIntegration"("integrationId");

-- CreateIndex
CREATE INDEX "PostRuleIntegration_ruleId_idx" ON "PostRuleIntegration"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "PostRuleIntegration_ruleId_integrationId_key" ON "PostRuleIntegration"("ruleId", "integrationId");

-- CreateIndex
CREATE INDEX "PostRulePipeline_organizationId_pipelineId_idx" ON "PostRulePipeline"("organizationId", "pipelineId");

-- CreateIndex
CREATE INDEX "PostRulePipeline_pipelineId_idx" ON "PostRulePipeline"("pipelineId");

-- CreateIndex
CREATE INDEX "PostRulePipeline_ruleId_idx" ON "PostRulePipeline"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "PostRulePipeline_ruleId_pipelineId_key" ON "PostRulePipeline"("ruleId", "pipelineId");

-- CreateIndex
CREATE INDEX "PostRuleRun_organizationId_idx" ON "PostRuleRun"("organizationId");

-- CreateIndex
CREATE INDEX "PostRuleRun_postId_idx" ON "PostRuleRun"("postId");

-- CreateIndex
CREATE INDEX "PostRuleRun_lineageId_idx" ON "PostRuleRun"("lineageId");

-- CreateIndex
CREATE INDEX "PostRuleRun_status_idx" ON "PostRuleRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PostRuleRun_ruleId_postId_key" ON "PostRuleRun"("ruleId", "postId");

-- CreateIndex
CREATE INDEX "PostRuleEvaluation_runId_status_idx" ON "PostRuleEvaluation"("runId", "status");

-- CreateIndex
CREATE INDEX "PostRuleEvaluation_scheduledAt_idx" ON "PostRuleEvaluation"("scheduledAt");

-- CreateIndex
CREATE INDEX "PostRuleEvaluation_organizationId_idx" ON "PostRuleEvaluation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PostRuleEvaluation_runId_evaluationIndex_key" ON "PostRuleEvaluation"("runId", "evaluationIndex");

-- AddForeignKey
ALTER TABLE "PostRule" ADD CONSTRAINT "PostRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRuleIntegration" ADD CONSTRAINT "PostRuleIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRuleIntegration" ADD CONSTRAINT "PostRuleIntegration_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PostRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRuleIntegration" ADD CONSTRAINT "PostRuleIntegration_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRulePipeline" ADD CONSTRAINT "PostRulePipeline_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRulePipeline" ADD CONSTRAINT "PostRulePipeline_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PostRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRulePipeline" ADD CONSTRAINT "PostRulePipeline_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRuleRun" ADD CONSTRAINT "PostRuleRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRuleRun" ADD CONSTRAINT "PostRuleRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PostRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRuleRun" ADD CONSTRAINT "PostRuleRun_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRuleEvaluation" ADD CONSTRAINT "PostRuleEvaluation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRuleEvaluation" ADD CONSTRAINT "PostRuleEvaluation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PostRuleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
