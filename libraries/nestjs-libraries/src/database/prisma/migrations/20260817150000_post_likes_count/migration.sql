-- Additive migration: denormalized like count on published posts for calendar display.
-- Populated from channel analytics post_lifetime snapshots (metricKey = like_count)
-- and refreshed when per-post analytics are fetched.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "likesCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Post" ADD COLUMN "likesSyncedAt" TIMESTAMP(3);
