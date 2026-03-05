-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "maxAssessmentsPerMonth" INTEGER NOT NULL DEFAULT 50,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "currentPeriodStart" DATETIME,
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usage_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "monthly_usage_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "assessmentsCount" INTEGER NOT NULL DEFAULT 0,
    "pdfCount" INTEGER NOT NULL DEFAULT 0,
    "proposalCount" INTEGER NOT NULL DEFAULT 0,
    "aiGenerationsCount" INTEGER NOT NULL DEFAULT 0,
    "dossierCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "monthly_usage_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publicSlug" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT 'default-org-id',
    "modules" TEXT NOT NULL,
    "pricingEstimate" TEXT NOT NULL,
    "roiSnapshot" TEXT NOT NULL,
    "presalesSnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "customNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "proposals_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "roi_projections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "operationalSavingsEstimate" REAL NOT NULL,
    "revenueIncreaseEstimate" REAL NOT NULL,
    "monthlyHoursRecovered" REAL NOT NULL,
    "estimatedPaybackMonths" REAL NOT NULL,
    "confidenceLevel" TEXT NOT NULL,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "avgHourlyCost" REAL,
    "avgTicket" REAL,
    "conversionRate" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "roi_projections_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "artifact_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentJson" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "artifact_reports_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payloadRedacted" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_logs_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "organizationId" TEXT NOT NULL DEFAULT 'default-org-id',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_events_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "presales_artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "executiveSummary" TEXT NOT NULL,
    "diagnosticQuestions" TEXT NOT NULL,
    "initialArchitecture" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "presales_artifacts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT 'default-org-id',
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ai_invocations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT 'default-org-id',
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" REAL NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL DEFAULT 'default-org-id',
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "client_workspaces" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'provisioning',
    "modulesEnabled" TEXT NOT NULL,
    "goLiveAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "implementation_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL DEFAULT 'admin',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "phase" TEXT NOT NULL DEFAULT 'setup',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "dueAt" DATETIME,
    "doneAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "implementation_tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "client_workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "integration_checklist_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_checklist_items_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "client_workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "content_artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "proposalId" TEXT,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hook" TEXT,
    "cta" TEXT,
    "hashtags" TEXT,
    "metadata" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "scheduledFor" DATETIME,
    "postedAt" DATETIME,
    "roiSnapshot" TEXT,
    "sourceInsight" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "lead_sequences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "scoreTier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentStage" TEXT NOT NULL DEFAULT 'post_click',
    "lastMessageAt" DATETIME,
    "nextAllowedAt" DATETIME,
    "convertedAt" DATETIME,
    "optedOutAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sequence_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequenceId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "templateKey" TEXT NOT NULL,
    "messageBody" TEXT NOT NULL,
    "scoreTier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "repliedAt" DATETIME,
    "waMessageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sequence_steps_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "lead_sequences" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "authority_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "assessmentId" TEXT,
    "proposalId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'internal',
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "keyMetrics" TEXT NOT NULL,
    "modules" TEXT,
    "sector" TEXT,
    "companySize" TEXT,
    "anonLevel" TEXT NOT NULL DEFAULT 'full',
    "originalData" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "publishedAt" DATETIME,
    "publishedUrl" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "proof_statistics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "sampleSize" INTEGER NOT NULL DEFAULT 1,
    "sector" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "outputJson" TEXT,
    "costUsd" REAL NOT NULL DEFAULT 0,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "errorMessage" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT
);

-- CreateTable
CREATE TABLE "action_queue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "executedAt" DATETIME,
    "reason" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "lockedByRunId" TEXT,
    "lockedUntil" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "policy_decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "actionQueueId" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "meeting_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "leadEmail" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "revenueScore" REAL NOT NULL DEFAULT 0,
    "closeProbability" REAL NOT NULL DEFAULT 0,
    "priorityTier" TEXT NOT NULL DEFAULT 'warm',
    "meetingUrl" TEXT,
    "externalEventId" TEXT,
    "googleEventId" TEXT,
    "adjustedProbability" REAL,
    "expectedRevenue" REAL,
    "confidenceScore" REAL,
    "followUpTone" TEXT,
    "urgencyLevel" INTEGER,
    "proposalStructure" TEXT,
    "recommendedCTA" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "proposal_draft_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "meetingSessionId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proposal_draft_links_meetingSessionId_fkey" FOREIGN KEY ("meetingSessionId") REFERENCES "meeting_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "review_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewerUserId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME
);

-- CreateTable
CREATE TABLE "meeting_performances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "closedValue" REAL NOT NULL DEFAULT 0,
    "notes" TEXT DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "meeting_performances_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "meeting_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "calendar_integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "ownerEmail" TEXT,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "expiryAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "whatsapp_message_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "actionQueueItemId" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "waMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "org_notification_channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "ownerWhatsApp" TEXT,
    "ownerEmail" TEXT,
    "preferChannel" TEXT NOT NULL DEFAULT 'whatsapp',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assessments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL DEFAULT 'default-org-id',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT,
    "whatsappConsent" BOOLEAN NOT NULL DEFAULT false,
    "segment" TEXT NOT NULL,
    "teamSize" TEXT NOT NULL,
    "volumeDay" TEXT NOT NULL,
    "channels" TEXT NOT NULL,
    "stack" TEXT NOT NULL,
    "pains" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "scoreTotal" INTEGER NOT NULL,
    "scoreBreakdown" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "recommendedMissions" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Novo',
    "internalNotes" TEXT,
    CONSTRAINT "assessments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_assessments" ("channels", "classification", "company", "createdAt", "email", "goal", "id", "name", "pains", "recommendedMissions", "role", "scoreBreakdown", "scoreTotal", "segment", "stack", "teamSize", "urgency", "volumeDay") SELECT "channels", "classification", "company", "createdAt", "email", "goal", "id", "name", "pains", "recommendedMissions", "role", "scoreBreakdown", "scoreTotal", "segment", "stack", "teamSize", "urgency", "volumeDay" FROM "assessments";
DROP TABLE "assessments";
ALTER TABLE "new_assessments" RENAME TO "assessments";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "usage_events_organizationId_type_createdAt_idx" ON "usage_events"("organizationId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_usage_snapshots_organizationId_month_key" ON "monthly_usage_snapshots"("organizationId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_publicSlug_key" ON "proposals"("publicSlug");

-- CreateIndex
CREATE UNIQUE INDEX "roi_projections_assessmentId_key" ON "roi_projections"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_reports_assessmentId_key" ON "artifact_reports"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_reports_publicSlug_key" ON "artifact_reports"("publicSlug");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_organizationId_key" ON "system_settings"("key", "organizationId");

-- CreateIndex
CREATE INDEX "alert_events_organizationId_createdAt_idx" ON "alert_events"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "alert_events_organizationId_type_resolved_idx" ON "alert_events"("organizationId", "type", "resolved");

-- CreateIndex
CREATE UNIQUE INDEX "client_workspaces_proposalId_key" ON "client_workspaces"("proposalId");

-- CreateIndex
CREATE INDEX "client_workspaces_organizationId_status_idx" ON "client_workspaces"("organizationId", "status");

-- CreateIndex
CREATE INDEX "implementation_tasks_workspaceId_status_idx" ON "implementation_tasks"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "integration_checklist_items_workspaceId_system_idx" ON "integration_checklist_items"("workspaceId", "system");

-- CreateIndex
CREATE INDEX "content_artifacts_organizationId_type_status_idx" ON "content_artifacts"("organizationId", "type", "status");

-- CreateIndex
CREATE INDEX "content_artifacts_organizationId_createdAt_idx" ON "content_artifacts"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "lead_sequences_assessmentId_key" ON "lead_sequences"("assessmentId");

-- CreateIndex
CREATE INDEX "lead_sequences_organizationId_status_currentStage_idx" ON "lead_sequences"("organizationId", "status", "currentStage");

-- CreateIndex
CREATE INDEX "lead_sequences_organizationId_nextAllowedAt_idx" ON "lead_sequences"("organizationId", "nextAllowedAt");

-- CreateIndex
CREATE INDEX "sequence_steps_sequenceId_stage_idx" ON "sequence_steps"("sequenceId", "stage");

-- CreateIndex
CREATE INDEX "sequence_steps_sequenceId_status_idx" ON "sequence_steps"("sequenceId", "status");

-- CreateIndex
CREATE INDEX "authority_assets_organizationId_type_status_idx" ON "authority_assets"("organizationId", "type", "status");

-- CreateIndex
CREATE INDEX "authority_assets_organizationId_status_idx" ON "authority_assets"("organizationId", "status");

-- CreateIndex
CREATE INDEX "proof_statistics_organizationId_isPublic_idx" ON "proof_statistics"("organizationId", "isPublic");

-- CreateIndex
CREATE INDEX "agent_runs_organizationId_agentName_status_idx" ON "agent_runs"("organizationId", "agentName", "status");

-- CreateIndex
CREATE INDEX "agent_runs_inputHash_idx" ON "agent_runs"("inputHash");

-- CreateIndex
CREATE INDEX "action_queue_organizationId_status_priority_idx" ON "action_queue"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "action_queue_lockedUntil_idx" ON "action_queue"("lockedUntil");

-- CreateIndex
CREATE INDEX "policy_decisions_organizationId_actionQueueId_idx" ON "policy_decisions"("organizationId", "actionQueueId");

-- CreateIndex
CREATE INDEX "meeting_sessions_organizationId_status_idx" ON "meeting_sessions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "meeting_sessions_leadEmail_idx" ON "meeting_sessions"("leadEmail");

-- CreateIndex
CREATE INDEX "meeting_sessions_organizationId_adjustedProbability_idx" ON "meeting_sessions"("organizationId", "adjustedProbability");

-- CreateIndex
CREATE INDEX "meeting_sessions_organizationId_expectedRevenue_idx" ON "meeting_sessions"("organizationId", "expectedRevenue");

-- CreateIndex
CREATE INDEX "meeting_sessions_organizationId_urgencyLevel_idx" ON "meeting_sessions"("organizationId", "urgencyLevel");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_draft_links_meetingSessionId_key" ON "proposal_draft_links"("meetingSessionId");

-- CreateIndex
CREATE INDEX "proposal_draft_links_orgId_idx" ON "proposal_draft_links"("orgId");

-- CreateIndex
CREATE INDEX "review_requests_orgId_status_idx" ON "review_requests"("orgId", "status");

-- CreateIndex
CREATE INDEX "review_requests_orgId_entityType_entityId_idx" ON "review_requests"("orgId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "meeting_performances_organizationId_sessionId_idx" ON "meeting_performances"("organizationId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_integrations_organizationId_key" ON "calendar_integrations"("organizationId");

-- CreateIndex
CREATE INDEX "calendar_integrations_organizationId_provider_idx" ON "calendar_integrations"("organizationId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_message_logs_actionQueueItemId_key" ON "whatsapp_message_logs"("actionQueueItemId");

-- CreateIndex
CREATE INDEX "whatsapp_message_logs_organizationId_status_idx" ON "whatsapp_message_logs"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "org_notification_channels_organizationId_key" ON "org_notification_channels"("organizationId");
