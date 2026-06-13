-- Migration preview only.
-- Do not apply automatically without reviewing data model impact.

CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pipeline_stages" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "probability" INTEGER,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pipelines_organizationId_idx" ON "pipelines"("organizationId");
CREATE INDEX "pipeline_stages_pipelineId_idx" ON "pipeline_stages"("pipelineId");
CREATE INDEX "deals_organizationId_idx" ON "deals"("organizationId");
CREATE INDEX "deals_contactId_idx" ON "deals"("contactId");
CREATE INDEX "deals_stageId_idx" ON "deals"("stageId");
CREATE INDEX "activities_organizationId_idx" ON "activities"("organizationId");
CREATE INDEX "activities_dealId_idx" ON "activities"("dealId");

ALTER TABLE "pipelines"
ADD CONSTRAINT "pipelines_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pipeline_stages"
ADD CONSTRAINT "pipeline_stages_pipelineId_fkey"
FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deals"
ADD CONSTRAINT "deals_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deals"
ADD CONSTRAINT "deals_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "contacts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deals"
ADD CONSTRAINT "deals_stageId_fkey"
FOREIGN KEY ("stageId") REFERENCES "pipeline_stages"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "activities"
ADD CONSTRAINT "activities_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activities"
ADD CONSTRAINT "activities_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "deals"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
