-- Stores the extra provider grant some channels need before private
-- interaction events can be subscribed to.
CREATE TABLE "ChannelInteractionAuthorization" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiration" TIMESTAMP(3),
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelInteractionAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChannelInteractionAuthorization_integrationId_key"
ON "ChannelInteractionAuthorization"("integrationId");

CREATE INDEX "ChannelInteractionAuthorization_organizationId_idx"
ON "ChannelInteractionAuthorization"("organizationId");

ALTER TABLE "ChannelInteractionAuthorization"
ADD CONSTRAINT "ChannelInteractionAuthorization_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChannelInteractionAuthorization"
ADD CONSTRAINT "ChannelInteractionAuthorization_integrationId_fkey"
FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
