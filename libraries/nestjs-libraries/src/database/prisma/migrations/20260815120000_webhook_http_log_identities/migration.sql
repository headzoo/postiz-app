-- Additive migration: denormalized source/target identities on webhook HTTP logs.
-- Existing rows remain null; no backfill.

ALTER TABLE "WebhookHttpLog" ADD COLUMN "sourceDisplayName" TEXT;
ALTER TABLE "WebhookHttpLog" ADD COLUMN "sourceUsername" TEXT;
ALTER TABLE "WebhookHttpLog" ADD COLUMN "targetDisplayName" TEXT;
ALTER TABLE "WebhookHttpLog" ADD COLUMN "targetUsername" TEXT;
