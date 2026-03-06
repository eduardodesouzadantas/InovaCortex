-- CreateTable
CREATE TABLE "proof_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "anonLevel" TEXT NOT NULL DEFAULT 'full',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metricsJson" TEXT NOT NULL,
    "publishedUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "proof_stat_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "avgPaybackMonths" REAL NOT NULL DEFAULT 0,
    "avgMonthlyEconomy" REAL NOT NULL DEFAULT 0,
    "avgMonthlyRevenue" REAL NOT NULL DEFAULT 0,
    "avgHoursSaved" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_client_workspaces" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'provisioning',
    "modulesEnabled" TEXT NOT NULL,
    "goLiveAt" DATETIME,
    "workspacePublicToken" TEXT NOT NULL,
    "allowPublicName" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_client_workspaces" ("assessmentId", "createdAt", "goLiveAt", "id", "modulesEnabled", "organizationId", "proposalId", "status", "updatedAt", "workspacePublicToken") SELECT "assessmentId", "createdAt", "goLiveAt", "id", "modulesEnabled", "organizationId", "proposalId", "status", "updatedAt", "workspacePublicToken" FROM "client_workspaces";
DROP TABLE "client_workspaces";
ALTER TABLE "new_client_workspaces" RENAME TO "client_workspaces";
CREATE UNIQUE INDEX "client_workspaces_proposalId_key" ON "client_workspaces"("proposalId");
CREATE UNIQUE INDEX "client_workspaces_workspacePublicToken_key" ON "client_workspaces"("workspacePublicToken");
CREATE INDEX "client_workspaces_organizationId_status_idx" ON "client_workspaces"("organizationId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "proof_assets_orgId_status_idx" ON "proof_assets"("orgId", "status");

-- CreateIndex
CREATE INDEX "proof_assets_orgId_type_idx" ON "proof_assets"("orgId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "proof_assets_orgId_workspaceId_type_anonLevel_key" ON "proof_assets"("orgId", "workspaceId", "type", "anonLevel");

-- CreateIndex
CREATE UNIQUE INDEX "proof_stat_snapshots_orgId_key" ON "proof_stat_snapshots"("orgId");
