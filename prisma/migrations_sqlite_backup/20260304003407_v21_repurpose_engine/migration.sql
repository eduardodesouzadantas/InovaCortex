-- CreateTable
CREATE TABLE "repurpose_artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "sourceMarketingPlanId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "formatsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "repurpose_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "sourceMarketingPlanId" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costUsd" REAL NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'success',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "repurpose_artifacts_orgId_sourceMarketingPlanId_idx" ON "repurpose_artifacts"("orgId", "sourceMarketingPlanId");

-- CreateIndex
CREATE INDEX "repurpose_artifacts_orgId_status_idx" ON "repurpose_artifacts"("orgId", "status");

-- CreateIndex
CREATE INDEX "repurpose_runs_orgId_idx" ON "repurpose_runs"("orgId");
