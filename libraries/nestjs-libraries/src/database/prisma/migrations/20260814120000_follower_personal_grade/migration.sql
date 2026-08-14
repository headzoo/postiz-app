-- Additive migration: per-user personal grades for audience members.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- CreateTable
CREATE TABLE "ChannelAudienceMemberGrade" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "counterpartyExternalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grade" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAudienceMemberGrade_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChannelAudienceMemberGrade_grade_half_star_check" CHECK (
      "grade" >= 1 AND "grade" <= 5 AND ("grade" * 2) = FLOOR("grade" * 2)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelAudienceMemberGrade_organizationId_integrationId_cou_key" ON "ChannelAudienceMemberGrade"("organizationId", "integrationId", "counterpartyExternalId", "userId");

-- CreateIndex
CREATE INDEX "ChannelAudienceMemberGrade_organizationId_integrationId_cou_idx" ON "ChannelAudienceMemberGrade"("organizationId", "integrationId", "counterpartyExternalId");

-- CreateIndex
CREATE INDEX "ChannelAudienceMemberGrade_userId_idx" ON "ChannelAudienceMemberGrade"("userId");

-- CreateIndex
CREATE INDEX "ChannelAudienceMemberGrade_organizationId_idx" ON "ChannelAudienceMemberGrade"("organizationId");

-- AddForeignKey
ALTER TABLE "ChannelAudienceMemberGrade" ADD CONSTRAINT "ChannelAudienceMemberGrade_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceMemberGrade" ADD CONSTRAINT "ChannelAudienceMemberGrade_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceMemberGrade" ADD CONSTRAINT "ChannelAudienceMemberGrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAudienceMemberGrade" ADD CONSTRAINT "ChannelAudienceMemberGrade_integrationId_counterpartyExter_fkey" FOREIGN KEY ("integrationId", "counterpartyExternalId") REFERENCES "ChannelAudienceMember"("integrationId", "externalId") ON DELETE RESTRICT ON UPDATE CASCADE;
