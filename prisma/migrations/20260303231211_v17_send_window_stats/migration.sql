-- CreateTable
CREATE TABLE "send_window_stats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "hourBucket" INTEGER NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "wonCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "send_window_stats_orgId_idx" ON "send_window_stats"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "send_window_stats_orgId_hourBucket_key" ON "send_window_stats"("orgId", "hourBucket");
