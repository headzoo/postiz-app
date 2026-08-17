-- Reset denormalized audience likesCount before rebuilding from polled post
-- likers. Prior webhook-driven increments are unreliable for X inbound likes.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

UPDATE "ChannelAudienceMember" SET "likesCount" = 0;
