-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publicSlug" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "signedName" TEXT,
    "signedEmail" TEXT,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "billing_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripeInvoiceId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "checkoutUrl" TEXT,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "contracts_proposalId_key" ON "contracts"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_publicSlug_key" ON "contracts"("publicSlug");

-- CreateIndex
CREATE INDEX "contracts_orgId_idx" ON "contracts"("orgId");

-- CreateIndex
CREATE INDEX "contracts_orgId_status_idx" ON "contracts"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_records_proposalId_key" ON "billing_records"("proposalId");

-- CreateIndex
CREATE INDEX "billing_records_orgId_idx" ON "billing_records"("orgId");

-- CreateIndex
CREATE INDEX "billing_records_orgId_status_idx" ON "billing_records"("orgId", "status");

-- CreateIndex
CREATE INDEX "billing_records_stripeCheckoutSessionId_idx" ON "billing_records"("stripeCheckoutSessionId");
