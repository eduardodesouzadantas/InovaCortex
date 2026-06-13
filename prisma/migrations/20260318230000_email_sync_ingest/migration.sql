-- Make email association optional and allow threads to retain history without a contact.
ALTER TABLE "email_threads" DROP CONSTRAINT "email_threads_contactId_fkey";
ALTER TABLE "email_messages" DROP CONSTRAINT "email_messages_contactId_fkey";

ALTER TABLE "email_threads" ALTER COLUMN "contactId" DROP NOT NULL;
ALTER TABLE "email_messages" ALTER COLUMN "contactId" DROP NOT NULL;

ALTER TABLE "email_threads" ADD COLUMN "dealId" TEXT;

CREATE INDEX "email_threads_organizationId_dealId_idx" ON "email_threads"("organizationId", "dealId");

ALTER TABLE "email_threads"
ADD CONSTRAINT "email_threads_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_threads"
ADD CONSTRAINT "email_threads_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_messages"
ADD CONSTRAINT "email_messages_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
