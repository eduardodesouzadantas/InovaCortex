-- CreateTable
CREATE TABLE "profit_leaks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedLossCents" INTEGER NOT NULL,
    "evidenceJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "profit_leak_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "totalLossCents" INTEGER NOT NULL,
    "topLeakKind" TEXT,
    "breakdownJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "profit_leaks_orgId_kind_severity_status_createdAt_idx" ON "profit_leaks"("orgId", "kind", "severity", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "profit_leak_snapshots_orgId_window_key" ON "profit_leak_snapshots"("orgId", "window");
