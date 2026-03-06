-- CreateTable
CREATE TABLE "prospects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "companySize" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "linkedinUrl" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "outbound_sequences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'connect',
    "nextAt" DATETIME NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "lastResult" TEXT NOT NULL DEFAULT 'unknown',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "outbound_sequences_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'linkedin',
    "templateKey" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'stub',
    "sentAt" DATETIME,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outbound_messages_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "outbound_messages_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "outbound_sequences" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "prospects_orgId_status_updatedAt_idx" ON "prospects"("orgId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "prospects_orgId_linkedinUrl_key" ON "prospects"("orgId", "linkedinUrl");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_sequences_prospectId_key" ON "outbound_sequences"("prospectId");

-- CreateIndex
CREATE INDEX "outbound_sequences_orgId_paused_nextAt_idx" ON "outbound_sequences"("orgId", "paused", "nextAt");

-- CreateIndex
CREATE INDEX "outbound_messages_orgId_prospectId_createdAt_idx" ON "outbound_messages"("orgId", "prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "outbound_messages_orgId_status_idx" ON "outbound_messages"("orgId", "status");
