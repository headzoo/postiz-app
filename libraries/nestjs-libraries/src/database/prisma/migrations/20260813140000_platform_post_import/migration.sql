-- AlterEnum
ALTER TYPE "CreationMethod" ADD VALUE 'PLATFORM';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "platformDeletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Post_integrationId_releaseId_idx" ON "Post"("integrationId", "releaseId");
