-- Additive migration: admin WebAuthn credentials, one-time ceremonies, and verification sessions.
-- Deployment command must be confirmed by operators; do not run against populated DB without review.

-- CreateEnum
CREATE TYPE "AdminWebAuthnChallengeKind" AS ENUM ('REGISTRATION', 'AUTHENTICATION');

-- CreateTable
CREATE TABLE "AdminPasskeyCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL,
    "transports" JSONB,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "aaguid" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AdminPasskeyCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminWebAuthnChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "kind" "AdminWebAuthnChallengeKind" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "AdminWebAuthnChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminVerificationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "authenticatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminVerificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminPasskeyCredential_credentialId_key" ON "AdminPasskeyCredential"("credentialId");

-- CreateIndex
CREATE INDEX "AdminPasskeyCredential_userId_idx" ON "AdminPasskeyCredential"("userId");

-- CreateIndex
CREATE INDEX "AdminPasskeyCredential_userId_revokedAt_idx" ON "AdminPasskeyCredential"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminWebAuthnChallenge_challenge_key" ON "AdminWebAuthnChallenge"("challenge");

-- CreateIndex
CREATE INDEX "AdminWebAuthnChallenge_userId_kind_expiresAt_idx" ON "AdminWebAuthnChallenge"("userId", "kind", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminWebAuthnChallenge_expiresAt_idx" ON "AdminWebAuthnChallenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminVerificationSession_tokenHash_key" ON "AdminVerificationSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminVerificationSession_userId_expiresAt_idx" ON "AdminVerificationSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminVerificationSession_userId_revokedAt_idx" ON "AdminVerificationSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AdminVerificationSession_credentialId_idx" ON "AdminVerificationSession"("credentialId");

-- AddForeignKey
ALTER TABLE "AdminPasskeyCredential" ADD CONSTRAINT "AdminPasskeyCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminWebAuthnChallenge" ADD CONSTRAINT "AdminWebAuthnChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminVerificationSession" ADD CONSTRAINT "AdminVerificationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminVerificationSession" ADD CONSTRAINT "AdminVerificationSession_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AdminPasskeyCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
