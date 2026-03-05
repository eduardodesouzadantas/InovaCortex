-- CreateTable
CREATE TABLE "deal_packets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "proposalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "tier" TEXT NOT NULL DEFAULT 'cold',
    "execOnePagerHtml" TEXT NOT NULL,
    "execSlug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "deal_signals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "dealPacketId" TEXT,
    "type" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deal_signals_dealPacketId_fkey" FOREIGN KEY ("dealPacketId") REFERENCES "deal_packets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "deal_packets_execSlug_key" ON "deal_packets"("execSlug");

-- CreateIndex
CREATE INDEX "deal_packets_orgId_status_idx" ON "deal_packets"("orgId", "status");

-- CreateIndex
CREATE INDEX "deal_packets_orgId_tier_idx" ON "deal_packets"("orgId", "tier");

-- CreateIndex
CREATE INDEX "deal_packets_orgId_assessmentId_idx" ON "deal_packets"("orgId", "assessmentId");

-- CreateIndex
CREATE INDEX "deal_signals_orgId_assessmentId_createdAt_idx" ON "deal_signals"("orgId", "assessmentId", "createdAt");

-- CreateIndex
CREATE INDEX "deal_signals_orgId_type_idx" ON "deal_signals"("orgId", "type");
