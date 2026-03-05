-- CreateTable
CREATE TABLE "system_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "strategic_insights" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impactScore" INTEGER NOT NULL DEFAULT 5,
    "estimatedRevenueImpact" INTEGER,
    "recommendedAction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "growth_signals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "message" TEXT NOT NULL,
    "metadataJson" TEXT,
    "actionTaken" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "benchmark_segments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgCount" INTEGER NOT NULL DEFAULT 0,
    "industry" TEXT NOT NULL,
    "sizeBand" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "timeWindow" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "benchmark_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segmentId" TEXT NOT NULL,
    "metrics" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "benchmark_snapshots_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "benchmark_segments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_chat_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'admin',
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "command" TEXT,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ai_chat_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_chat_memory_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "summary" TEXT,
    "sourceRef" TEXT,
    "evidenceIdsJson" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "title" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkText" TEXT NOT NULL,
    "chunkHash" TEXT NOT NULL DEFAULT '',
    "embedding" TEXT,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "retrieval_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT,
    "queryText" TEXT NOT NULL,
    "topK" INTEGER NOT NULL DEFAULT 5,
    "resultsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "retrieval_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ai_chat_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "whatsapp_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'sales',
    "userId" TEXT,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "whatsapp_users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales_reps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'SDR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sales_reps_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_reps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "lead_assignments_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lead_assignments_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "sales_reps" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lead_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales_targets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "salesRepId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "targetCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_targets_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "sales_reps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'percent',
    "value" INTEGER NOT NULL,
    "appliesTo" TEXT NOT NULL DEFAULT 'payment',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commission_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "commission_payouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "salesRepId" TEXT NOT NULL,
    "commissionRuleId" TEXT,
    "billingRecordId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commission_payouts_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "sales_reps" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "commission_payouts_commissionRuleId_fkey" FOREIGN KEY ("commissionRuleId") REFERENCES "commission_rules" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "phoneNumberE164" TEXT NOT NULL,
    "wa_id" TEXT,
    "name" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "lifecycle" TEXT NOT NULL DEFAULT 'lead',
    "lastMessageAt" DATETIME,
    "lastInboundAt" DATETIME,
    "lastOutboundAt" DATETIME,
    "sessionWindowUntil" DATETIME,
    "optedOutAt" DATETIME,
    "optOutReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "whatsapp_conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "slaDueAt" DATETIME,
    "lastMessageAt" DATETIME,
    "lastMessagePreview" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "whatsapp_conversations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "whatsapp_conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "whatsapp_conversations_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "text" TEXT,
    "mediaUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "replyToId" TEXT,
    "errorJson" TEXT,
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "readAt" DATETIME,
    "failedAt" DATETIME,
    "metaStatusPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "whatsapp_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "whatsapp_opt_ins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "consentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proofJson" TEXT,
    CONSTRAINT "whatsapp_opt_ins_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pt_BR',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "bodyJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "whatsapp_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "whatsapp_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segmentQuery" TEXT NOT NULL,
    "scheduleAt" DATETIME,
    "throttlePolicy" TEXT NOT NULL,
    "stats" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "whatsapp_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "whatsapp_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "whatsapp_templates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "whatsapp_campaign_sends" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorCode" TEXT,
    "sentAt" DATETIME,
    CONSTRAINT "whatsapp_campaign_sends_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatsapp_campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "whatsapp_campaign_sends_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "maxAssessmentsPerMonth" INTEGER NOT NULL DEFAULT 50,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "industry" TEXT NOT NULL DEFAULT 'Services',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "currentPeriodStart" DATETIME,
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_organizations" ("createdAt", "currentPeriodEnd", "currentPeriodStart", "id", "maxAssessmentsPerMonth", "maxUsers", "name", "plan", "slug", "stripeCustomerId", "stripeSubscriptionId", "subscriptionStatus", "updatedAt") SELECT "createdAt", "currentPeriodEnd", "currentPeriodStart", "id", "maxAssessmentsPerMonth", "maxUsers", "name", "plan", "slug", "stripeCustomerId", "stripeSubscriptionId", "subscriptionStatus", "updatedAt" FROM "organizations";
DROP TABLE "organizations";
ALTER TABLE "new_organizations" RENAME TO "organizations";
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE TABLE "new_prospects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "companySize" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "linkedinUrl" TEXT NOT NULL,
    "estimatedRevenue" TEXT,
    "discoverySource" TEXT NOT NULL DEFAULT 'ai_agent',
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_prospects" ("company", "companySize", "createdAt", "email", "fullName", "id", "industry", "linkedinUrl", "location", "notes", "orgId", "phone", "source", "status", "title", "updatedAt") SELECT "company", "companySize", "createdAt", "email", "fullName", "id", "industry", "linkedinUrl", "location", "notes", "orgId", "phone", "source", "status", "title", "updatedAt" FROM "prospects";
DROP TABLE "prospects";
ALTER TABLE "new_prospects" RENAME TO "prospects";
CREATE INDEX "prospects_orgId_status_updatedAt_idx" ON "prospects"("orgId", "status", "updatedAt");
CREATE UNIQUE INDEX "prospects_orgId_linkedinUrl_key" ON "prospects"("orgId", "linkedinUrl");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "system_events_organizationId_createdAt_idx" ON "system_events"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "system_events_organizationId_type_idx" ON "system_events"("organizationId", "type");

-- CreateIndex
CREATE INDEX "strategic_insights_organizationId_status_category_idx" ON "strategic_insights"("organizationId", "status", "category");

-- CreateIndex
CREATE INDEX "growth_signals_organizationId_type_idx" ON "growth_signals"("organizationId", "type");

-- CreateIndex
CREATE INDEX "benchmark_segments_industry_sizeBand_plan_timeWindow_periodEnd_idx" ON "benchmark_segments"("industry", "sizeBand", "plan", "timeWindow", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_snapshots_segmentId_key" ON "benchmark_snapshots"("segmentId");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_organizationId_idx" ON "ai_chat_sessions"("organizationId");

-- CreateIndex
CREATE INDEX "ai_chat_messages_sessionId_idx" ON "ai_chat_messages"("sessionId");

-- CreateIndex
CREATE INDEX "ai_chat_messages_organizationId_idx" ON "ai_chat_messages"("organizationId");

-- CreateIndex
CREATE INDEX "ai_chat_memory_items_organizationId_type_idx" ON "ai_chat_memory_items"("organizationId", "type");

-- CreateIndex
CREATE INDEX "knowledge_documents_organizationId_sourceType_idx" ON "knowledge_documents"("organizationId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_organizationId_sourceType_sourceId_key" ON "knowledge_documents"("organizationId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_organizationId_documentId_idx" ON "knowledge_chunks"("organizationId", "documentId");

-- CreateIndex
CREATE INDEX "retrieval_logs_organizationId_sessionId_idx" ON "retrieval_logs"("organizationId", "sessionId");

-- CreateIndex
CREATE INDEX "whatsapp_users_organizationId_idx" ON "whatsapp_users"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_users_phoneNumber_organizationId_key" ON "whatsapp_users"("phoneNumber", "organizationId");

-- CreateIndex
CREATE INDEX "sales_reps_organizationId_idx" ON "sales_reps"("organizationId");

-- CreateIndex
CREATE INDEX "lead_assignments_salesRepId_idx" ON "lead_assignments"("salesRepId");

-- CreateIndex
CREATE INDEX "lead_assignments_assessmentId_idx" ON "lead_assignments"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_targets_salesRepId_month_key" ON "sales_targets"("salesRepId", "month");

-- CreateIndex
CREATE INDEX "commission_rules_organizationId_idx" ON "commission_rules"("organizationId");

-- CreateIndex
CREATE INDEX "commission_payouts_salesRepId_status_idx" ON "commission_payouts"("salesRepId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_organizationId_phoneNumberE164_key" ON "contacts"("organizationId", "phoneNumberE164");

-- CreateIndex
CREATE INDEX "whatsapp_conversations_organizationId_status_slaDueAt_idx" ON "whatsapp_conversations"("organizationId", "status", "slaDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversations_organizationId_contactId_key" ON "whatsapp_conversations"("organizationId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_messageId_key" ON "whatsapp_messages"("messageId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_conversationId_createdAt_idx" ON "whatsapp_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_opt_ins_contactId_key" ON "whatsapp_opt_ins"("contactId");

-- CreateIndex
CREATE INDEX "whatsapp_opt_ins_contactId_idx" ON "whatsapp_opt_ins"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_organizationId_name_language_key" ON "whatsapp_templates"("organizationId", "name", "language");

-- CreateIndex
CREATE INDEX "whatsapp_campaigns_organizationId_status_idx" ON "whatsapp_campaigns"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_campaign_sends_campaignId_contactId_key" ON "whatsapp_campaign_sends"("campaignId", "contactId");
