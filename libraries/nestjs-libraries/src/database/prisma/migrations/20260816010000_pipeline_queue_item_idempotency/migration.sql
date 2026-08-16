ALTER TABLE "PipelineQueueItem" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "PipelineQueueItem_idempotencyKey_key"
ON "PipelineQueueItem"("idempotencyKey");
