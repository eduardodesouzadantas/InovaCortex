-- CreateTable
CREATE TABLE "strategy_recommendations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceJson" TEXT NOT NULL,
    "impactScore" INTEGER NOT NULL,
    "effortScore" INTEGER NOT NULL,
    "roiCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "experiment_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "baselineValue" REAL,
    "targetValue" REAL,
    "planJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "strategy_recommendations_organizationId_status_impactScore_idx" ON "strategy_recommendations"("organizationId", "status", "impactScore");

-- CreateIndex
CREATE INDEX "experiment_plans_organizationId_status_idx" ON "experiment_plans"("organizationId", "status");
