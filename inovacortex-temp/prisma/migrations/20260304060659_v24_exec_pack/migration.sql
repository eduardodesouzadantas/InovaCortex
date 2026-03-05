-- CreateTable
CREATE TABLE "exec_packs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payloadJson" TEXT NOT NULL,
    "anonymized" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "exec_packs_publicSlug_key" ON "exec_packs"("publicSlug");

-- CreateIndex
CREATE INDEX "exec_packs_orgId_generatedAt_idx" ON "exec_packs"("orgId", "generatedAt");
