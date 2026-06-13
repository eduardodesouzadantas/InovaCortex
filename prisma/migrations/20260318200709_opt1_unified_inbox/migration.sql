-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "email_integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "ownerEmail" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "expiryAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_threads" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "externalThreadId" TEXT NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "slaDueAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_integrations_organizationId_key" ON "email_integrations"("organizationId");

-- CreateIndex
CREATE INDEX "email_threads_organizationId_status_slaDueAt_idx" ON "email_threads"("organizationId", "status", "slaDueAt");

-- CreateIndex
CREATE INDEX "email_threads_organizationId_assignedUserId_idx" ON "email_threads"("organizationId", "assignedUserId");

-- CreateIndex
CREATE INDEX "email_threads_organizationId_status_lastMessageAt_idx" ON "email_threads"("organizationId", "status", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_threads_organizationId_externalThreadId_key" ON "email_threads"("organizationId", "externalThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_externalMessageId_key" ON "email_messages"("externalMessageId");

-- CreateIndex
CREATE INDEX "email_messages_organizationId_idx" ON "email_messages"("organizationId");

-- CreateIndex
CREATE INDEX "email_messages_contactId_idx" ON "email_messages"("contactId");

-- CreateIndex
CREATE INDEX "email_messages_threadId_createdAt_idx" ON "email_messages"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "email_integrations" ADD CONSTRAINT "email_integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
