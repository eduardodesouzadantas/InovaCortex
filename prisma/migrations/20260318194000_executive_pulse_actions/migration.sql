-- CreateTable
CREATE TABLE "executive_pulse_actions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pulseKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "lastActionAt" TIMESTAMP(3),
    "lastActionBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executive_pulse_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "executive_pulse_actions_organizationId_pulseKey_key" ON "executive_pulse_actions"("organizationId", "pulseKey");

-- CreateIndex
CREATE INDEX "executive_pulse_actions_organizationId_status_updatedAt_idx" ON "executive_pulse_actions"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "executive_pulse_actions_organizationId_linkedEntityType_link_idx" ON "executive_pulse_actions"("organizationId", "linkedEntityType", "linkedEntityId");

-- AddForeignKey
ALTER TABLE "executive_pulse_actions" ADD CONSTRAINT "executive_pulse_actions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
