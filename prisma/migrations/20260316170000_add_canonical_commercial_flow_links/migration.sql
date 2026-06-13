ALTER TABLE "assessments"
ADD COLUMN "contactId" TEXT,
ADD COLUMN "dealId" TEXT;

ALTER TABLE "proposals"
ADD COLUMN "dealId" TEXT;

CREATE INDEX "assessments_contactId_idx" ON "assessments"("contactId");
CREATE INDEX "assessments_dealId_idx" ON "assessments"("dealId");
CREATE INDEX "proposals_dealId_idx" ON "proposals"("dealId");

ALTER TABLE "assessments"
ADD CONSTRAINT "assessments_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "contacts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assessments"
ADD CONSTRAINT "assessments_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "deals"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "proposals"
ADD CONSTRAINT "proposals_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "deals"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
