-- Additive migration: org/channel-scoped ignore flag for audience members.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- AlterTable
ALTER TABLE "ChannelAudienceMember" ADD COLUMN "ignoredAt" TIMESTAMP(3),
ADD COLUMN "ignoredByUserId" TEXT;

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_ignored_keyset_idx" ON "ChannelAudienceMember"("integrationId", "membershipState", "ignoredAt", "externalId");

-- CreateIndex
CREATE INDEX "ChannelAudienceMember_ignoredByUserId_idx" ON "ChannelAudienceMember"("ignoredByUserId");

-- AddForeignKey
ALTER TABLE "ChannelAudienceMember" ADD CONSTRAINT "ChannelAudienceMember_ignoredByUserId_fkey" FOREIGN KEY ("ignoredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
