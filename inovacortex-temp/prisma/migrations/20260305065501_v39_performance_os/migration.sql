-- CreateTable
CREATE TABLE "sales_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_assignments_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "sales_reps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "performance_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "salesRepId" TEXT,
    "window" TEXT NOT NULL DEFAULT '7d',
    "statsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "performance_snapshots_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "sales_reps" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_assignments_organizationId_entityType_entityId_key" ON "sales_assignments"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "performance_snapshots_organizationId_window_idx" ON "performance_snapshots"("organizationId", "window");
