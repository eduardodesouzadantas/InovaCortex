/*
  Warnings:

  - The required column `workspacePublicToken` was added to the `client_workspaces` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateTable
CREATE TABLE "workspace_uploads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_uploads_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "client_workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workspace_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT,
    "authorType" TEXT NOT NULL DEFAULT 'client',
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_comments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "client_workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "workspace_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "implementation_tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_client_workspaces" ("assessmentId", "createdAt", "goLiveAt", "id", "modulesEnabled", "organizationId", "proposalId", "status", "updatedAt") SELECT "assessmentId", "createdAt", "goLiveAt", "id", "modulesEnabled", "organizationId", "proposalId", "status", "updatedAt" FROM "client_workspaces";
DROP TABLE "client_workspaces";
ALTER TABLE "new_client_workspaces" RENAME TO "client_workspaces";
CREATE UNIQUE INDEX "client_workspaces_proposalId_key" ON "client_workspaces"("proposalId");
CREATE UNIQUE INDEX "client_workspaces_workspacePublicToken_key" ON "client_workspaces"("workspacePublicToken");
CREATE INDEX "client_workspaces_organizationId_status_idx" ON "client_workspaces"("organizationId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "workspace_uploads_workspaceId_idx" ON "workspace_uploads"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_uploads_orgId_type_idx" ON "workspace_uploads"("orgId", "type");

-- CreateIndex
CREATE INDEX "workspace_comments_workspaceId_idx" ON "workspace_comments"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_comments_taskId_idx" ON "workspace_comments"("taskId");
