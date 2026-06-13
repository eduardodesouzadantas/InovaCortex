-- Adds tenant access tables and backfills new organization-scoped columns safely.

CREATE TABLE "agency_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_accesses" (
    "id" TEXT NOT NULL,
    "agencyMembershipId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_accesses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_channels" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_channels_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "whatsapp_messages" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "whatsapp_messages" ADD COLUMN "contactId" TEXT;
ALTER TABLE "implementation_tasks" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "integration_checklist_items" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "lead_assignments" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "offer_assets" ADD COLUMN "organizationId" TEXT;

UPDATE "whatsapp_messages" AS wm
SET
    "organizationId" = wc."organizationId",
    "contactId" = wc."contactId"
FROM "whatsapp_conversations" AS wc
WHERE wm."conversationId" = wc."id";

UPDATE "implementation_tasks" AS it
SET "organizationId" = cw."organizationId"
FROM "client_workspaces" AS cw
WHERE it."workspaceId" = cw."id";

UPDATE "integration_checklist_items" AS ici
SET "organizationId" = cw."organizationId"
FROM "client_workspaces" AS cw
WHERE ici."workspaceId" = cw."id";

UPDATE "lead_assignments" AS la
SET "organizationId" = a."organizationId"
FROM "assessments" AS a
WHERE la."assessmentId" = a."id";

UPDATE "offer_assets" AS oa
SET "organizationId" = o."organizationId"
FROM "offers" AS o
WHERE oa."offerId" = o."id";

ALTER TABLE "whatsapp_messages" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "whatsapp_messages" ALTER COLUMN "contactId" SET NOT NULL;
ALTER TABLE "implementation_tasks" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "integration_checklist_items" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "lead_assignments" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "offer_assets" ALTER COLUMN "organizationId" SET NOT NULL;

CREATE UNIQUE INDEX "agency_memberships_userId_organizationId_key" ON "agency_memberships"("userId", "organizationId");
CREATE INDEX "agency_memberships_organizationId_idx" ON "agency_memberships"("organizationId");
CREATE INDEX "agency_memberships_userId_active_idx" ON "agency_memberships"("userId", "active");

CREATE UNIQUE INDEX "organization_accesses_agencyMembershipId_organizationId_key" ON "organization_accesses"("agencyMembershipId", "organizationId");
CREATE INDEX "organization_accesses_organizationId_idx" ON "organization_accesses"("organizationId");
CREATE INDEX "organization_accesses_agencyMembershipId_active_idx" ON "organization_accesses"("agencyMembershipId", "active");

CREATE UNIQUE INDEX "whatsapp_channels_phoneNumberId_key" ON "whatsapp_channels"("phoneNumberId");
CREATE INDEX "whatsapp_channels_organizationId_idx" ON "whatsapp_channels"("organizationId");

CREATE INDEX "whatsapp_messages_organizationId_idx" ON "whatsapp_messages"("organizationId");
CREATE INDEX "whatsapp_messages_contactId_idx" ON "whatsapp_messages"("contactId");
CREATE INDEX "implementation_tasks_organizationId_idx" ON "implementation_tasks"("organizationId");
CREATE INDEX "integration_checklist_items_organizationId_idx" ON "integration_checklist_items"("organizationId");
CREATE INDEX "lead_assignments_organizationId_idx" ON "lead_assignments"("organizationId");
CREATE INDEX "offer_assets_organizationId_idx" ON "offer_assets"("organizationId");

ALTER TABLE "agency_memberships"
ADD CONSTRAINT "agency_memberships_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agency_memberships"
ADD CONSTRAINT "agency_memberships_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_accesses"
ADD CONSTRAINT "organization_accesses_agencyMembershipId_fkey"
FOREIGN KEY ("agencyMembershipId") REFERENCES "agency_memberships"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_accesses"
ADD CONSTRAINT "organization_accesses_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "whatsapp_channels"
ADD CONSTRAINT "whatsapp_channels_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "whatsapp_messages"
ADD CONSTRAINT "whatsapp_messages_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "whatsapp_messages"
ADD CONSTRAINT "whatsapp_messages_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "contacts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "implementation_tasks"
ADD CONSTRAINT "implementation_tasks_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integration_checklist_items"
ADD CONSTRAINT "integration_checklist_items_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_assignments"
ADD CONSTRAINT "lead_assignments_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "offer_assets"
ADD CONSTRAINT "offer_assets_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
