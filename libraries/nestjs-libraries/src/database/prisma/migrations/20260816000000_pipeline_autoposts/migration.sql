ALTER TABLE "AutoPost" ADD COLUMN "pipelineId" TEXT;

CREATE INDEX "AutoPost_organizationId_pipelineId_deletedAt_idx"
ON "AutoPost"("organizationId", "pipelineId", "deletedAt");

CREATE INDEX "AutoPost_pipelineId_idx" ON "AutoPost"("pipelineId");

ALTER TABLE "AutoPost"
ADD CONSTRAINT "AutoPost_pipelineId_fkey"
FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
