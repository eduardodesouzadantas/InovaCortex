-- CreateTable
CREATE TABLE "public_api_keys" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_api_keys_keyHash_key" ON "public_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "public_api_keys_organizationId_revokedAt_idx" ON "public_api_keys"("organizationId", "revokedAt");

-- CreateIndex
CREATE INDEX "public_api_keys_organizationId_createdAt_idx" ON "public_api_keys"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "public_api_keys" ADD CONSTRAINT "public_api_keys_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
