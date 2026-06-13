CREATE TABLE "war_room_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "revenueToday" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenueThisMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pipelineValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activeDeals" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "campaignPerformance" TEXT NOT NULL,
    "riskAlerts" TEXT NOT NULL,
    "profitLeakSignals" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "war_room_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "war_room_snapshots_organizationId_createdAt_idx"
ON "war_room_snapshots"("organizationId", "createdAt");

ALTER TABLE "war_room_snapshots"
ADD CONSTRAINT "war_room_snapshots_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
