CREATE TABLE "onboarding_statuses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "emailConnectedAt" TIMESTAMP(3),
    "pipelineConfiguredAt" TIMESTAMP(3),
    "firstContactAt" TIMESTAMP(3),
    "firstDealAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "onboarding_statuses_organizationId_key" ON "onboarding_statuses"("organizationId");
CREATE INDEX "onboarding_statuses_organizationId_status_idx" ON "onboarding_statuses"("organizationId", "status");

ALTER TABLE "onboarding_statuses"
ADD CONSTRAINT "onboarding_statuses_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
