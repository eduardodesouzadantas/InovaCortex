-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "maxAssessmentsPerMonth" INTEGER NOT NULL DEFAULT 50,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "industry" TEXT NOT NULL DEFAULT 'Services',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_usage_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "assessmentsCount" INTEGER NOT NULL DEFAULT 0,
    "pdfCount" INTEGER NOT NULL DEFAULT 0,
    "proposalCount" INTEGER NOT NULL DEFAULT 0,
    "aiGenerationsCount" INTEGER NOT NULL DEFAULT 0,
    "dossierCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_usage_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roi_projections" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "operationalSavingsEstimate" DOUBLE PRECISION NOT NULL,
    "revenueIncreaseEstimate" DOUBLE PRECISION NOT NULL,
    "monthlyHoursRecovered" DOUBLE PRECISION NOT NULL,
    "estimatedPaybackMonths" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" TEXT NOT NULL,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "avgHourlyCost" DOUBLE PRECISION,
    "avgTicket" DOUBLE PRECISION,
    "conversionRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roi_projections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_reports" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentJson" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "artifact_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payloadRedacted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "organizationId" TEXT NOT NULL DEFAULT 'default-org-id',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presales_artifacts" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "executiveSummary" TEXT NOT NULL,
    "diagnosticQuestions" TEXT NOT NULL,
    "initialArchitecture" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presales_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT 'default-org-id',
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_invocations" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT 'default-org-id',
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_invocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT 'default-org-id',
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_workspaces" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'provisioning',
    "modulesEnabled" TEXT NOT NULL,
    "goLiveAt" TIMESTAMP(3),
    "workspacePublicToken" TEXT NOT NULL,
    "allowPublicName" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "implementation_tasks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL DEFAULT 'admin',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "phase" TEXT NOT NULL DEFAULT 'setup',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "implementation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_checklist_items" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_uploads" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_comments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT,
    "authorType" TEXT NOT NULL DEFAULT 'client',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_artifacts" (
    "id" TEXT NOT NULL,
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
    "reviewedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "roiSnapshot" TEXT,
    "sourceInsight" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_sequences" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "scoreTier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentStage" TEXT NOT NULL DEFAULT 'post_click',
    "lastMessageAt" TIMESTAMP(3),
    "nextAllowedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_steps" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "templateKey" TEXT NOT NULL,
    "messageBody" TEXT NOT NULL,
    "scoreTier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "waMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sequence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authority_assets" (
    "id" TEXT NOT NULL,
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
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authority_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_statistics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "sampleSize" INTEGER NOT NULL DEFAULT 1,
    "sector" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "outputJson" TEXT,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_queue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "reason" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "lockedByRunId" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_decisions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actionQueueId" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_sessions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "leadEmail" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "revenueScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closeProbability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priorityTier" TEXT NOT NULL DEFAULT 'warm',
    "meetingUrl" TEXT,
    "externalEventId" TEXT,
    "googleEventId" TEXT,
    "adjustedProbability" DOUBLE PRECISION,
    "expectedRevenue" DOUBLE PRECISION,
    "confidenceScore" DOUBLE PRECISION,
    "followUpTone" TEXT,
    "urgencyLevel" INTEGER,
    "proposalStructure" TEXT,
    "recommendedCTA" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_draft_links" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "meetingSessionId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_draft_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_requests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewerUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_performances" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "closedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_performances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "ownerEmail" TEXT,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "expiryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_message_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actionQueueItemId" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "waMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_notification_channels" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerWhatsApp" TEXT,
    "ownerEmail" TEXT,
    "preferChannel" TEXT NOT NULL DEFAULT 'whatsapp',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "send_window_stats" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "hourBucket" INTEGER NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "wonCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "send_window_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_budgets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dailyTokenLimit" INTEGER NOT NULL DEFAULT 20000,
    "dailyTokenUsed" INTEGER NOT NULL DEFAULT 0,
    "dailyCostUsdUsed" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "resetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hardStop" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_cache" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputJson" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publicSlug" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "signedName" TEXT,
    "signedEmail" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_records" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripeInvoiceId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "checkoutUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_plans" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "postType" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "contentJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledFor" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_integrations" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "linkedinStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "instagramStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "metaPageId" TEXT,
    "metaAccessTokenEnc" TEXT,
    "linkedinAccessTokenEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "marketingPlanId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "externalPostId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repurpose_artifacts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceMarketingPlanId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "formatsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repurpose_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repurpose_runs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceMarketingPlanId" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'success',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repurpose_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_assets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "anonLevel" TEXT NOT NULL DEFAULT 'full',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metricsJson" TEXT NOT NULL,
    "publishedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proof_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_stat_snapshots" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "avgPaybackMonths" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgMonthlyEconomy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgMonthlyRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgHoursSaved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proof_stat_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_packets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "proposalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "tier" TEXT NOT NULL DEFAULT 'cold',
    "execOnePagerHtml" TEXT NOT NULL,
    "execSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_packets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_signals" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "dealPacketId" TEXT,
    "type" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospects" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_sequences" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'connect',
    "nextAt" TIMESTAMP(3) NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "lastResult" TEXT NOT NULL DEFAULT 'unknown',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'linkedin',
    "templateKey" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'stub',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profit_leaks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedLossCents" INTEGER NOT NULL,
    "evidenceJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profit_leaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profit_leak_snapshots" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "totalLossCents" INTEGER NOT NULL,
    "topLeakKind" TEXT,
    "breakdownJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profit_leak_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exec_packs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payloadJson" TEXT NOT NULL,
    "anonymized" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exec_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "build_templates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "blueprintJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "build_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_runs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "targetOrgSlug" TEXT,
    "targetWorkspaceId" TEXT,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "inputJson" TEXT NOT NULL,
    "outputJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "build_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_artifacts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "buildRunId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "body" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "build_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupeKey" TEXT,

    CONSTRAINT "system_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategic_insights" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impactScore" INTEGER NOT NULL DEFAULT 5,
    "estimatedRevenueImpact" INTEGER,
    "recommendedAction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategic_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_signals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "message" TEXT NOT NULL,
    "metadataJson" TEXT,
    "actionTaken" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_segments" (
    "id" TEXT NOT NULL,
    "orgCount" INTEGER NOT NULL DEFAULT 0,
    "industry" TEXT NOT NULL,
    "sizeBand" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "timeWindow" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmark_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_snapshots" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "metrics" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_sessions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'admin',
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "command" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_memory_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "summary" TEXT,
    "sourceRef" TEXT,
    "evidenceIdsJson" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_memory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "title" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkText" TEXT NOT NULL,
    "chunkHash" TEXT NOT NULL DEFAULT '',
    "embedding" TEXT,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retrieval_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT,
    "queryText" TEXT NOT NULL,
    "topK" INTEGER NOT NULL DEFAULT 5,
    "resultsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retrieval_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_users" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'sales',
    "userId" TEXT,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_reps" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'SDR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_reps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_targets" (
    "id" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "targetCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'percent',
    "value" INTEGER NOT NULL,
    "appliesTo" TEXT NOT NULL DEFAULT 'payment',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_payouts" (
    "id" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "commissionRuleId" TEXT,
    "billingRecordId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneNumberE164" TEXT NOT NULL,
    "wa_id" TEXT,
    "name" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "lifecycle" TEXT NOT NULL DEFAULT 'lead',
    "lastMessageAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "sessionWindowUntil" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "optOutReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_conversations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "slaDueAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "text" TEXT,
    "mediaUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "replyToId" TEXT,
    "errorJson" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "metaStatusPayload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_opt_ins" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proofJson" TEXT,

    CONSTRAINT "whatsapp_opt_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pt_BR',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "bodyJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_campaigns" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segmentQuery" TEXT NOT NULL,
    "scheduleAt" TIMESTAMP(3),
    "throttlePolicy" TEXT NOT NULL,
    "stats" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_campaign_sends" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorCode" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "whatsapp_campaign_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_recommendations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceJson" TEXT NOT NULL,
    "impactScore" INTEGER NOT NULL,
    "effortScore" INTEGER NOT NULL,
    "roiCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategy_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "baselineValue" DOUBLE PRECISION,
    "targetValue" DOUBLE PRECISION,
    "planJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "niche" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "offerJson" TEXT NOT NULL,
    "roiModelJson" TEXT NOT NULL,
    "publishedSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_assets" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_assignments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "salesRepId" TEXT,
    "window" TEXT NOT NULL DEFAULT '7d',
    "statsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbooks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "approvalMode" TEXT NOT NULL DEFAULT 'requires_admin',
    "policyJson" TEXT NOT NULL,
    "stepsJson" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_runs" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "actorUserId" TEXT,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "inputJson" TEXT,
    "resultJson" TEXT,
    "errorJson" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playbook_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_approvals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "playbookRunId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "requiredRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "playbook_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "usage_events_organizationId_type_createdAt_idx" ON "usage_events"("organizationId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_usage_snapshots_organizationId_month_key" ON "monthly_usage_snapshots"("organizationId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "assessments_organizationId_status_idx" ON "assessments"("organizationId", "status");

-- CreateIndex
CREATE INDEX "assessments_email_idx" ON "assessments"("email");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_publicSlug_key" ON "proposals"("publicSlug");

-- CreateIndex
CREATE INDEX "proposals_assessmentId_idx" ON "proposals"("assessmentId");

-- CreateIndex
CREATE INDEX "proposals_organizationId_status_idx" ON "proposals"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "roi_projections_assessmentId_key" ON "roi_projections"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_reports_assessmentId_key" ON "artifact_reports"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_reports_publicSlug_key" ON "artifact_reports"("publicSlug");

-- CreateIndex
CREATE INDEX "message_logs_assessmentId_idx" ON "message_logs"("assessmentId");

-- CreateIndex
CREATE INDEX "audit_events_assessmentId_idx" ON "audit_events"("assessmentId");

-- CreateIndex
CREATE INDEX "audit_events_organizationId_createdAt_idx" ON "audit_events"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_organizationId_key" ON "system_settings"("key", "organizationId");

-- CreateIndex
CREATE INDEX "ai_invocations_assessmentId_idx" ON "ai_invocations"("assessmentId");

-- CreateIndex
CREATE INDEX "ai_invocations_organizationId_status_idx" ON "ai_invocations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "alert_events_organizationId_createdAt_idx" ON "alert_events"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "alert_events_organizationId_type_resolved_idx" ON "alert_events"("organizationId", "type", "resolved");

-- CreateIndex
CREATE UNIQUE INDEX "client_workspaces_proposalId_key" ON "client_workspaces"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "client_workspaces_workspacePublicToken_key" ON "client_workspaces"("workspacePublicToken");

-- CreateIndex
CREATE INDEX "client_workspaces_organizationId_status_idx" ON "client_workspaces"("organizationId", "status");

-- CreateIndex
CREATE INDEX "implementation_tasks_workspaceId_status_idx" ON "implementation_tasks"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "integration_checklist_items_workspaceId_system_idx" ON "integration_checklist_items"("workspaceId", "system");

-- CreateIndex
CREATE INDEX "workspace_uploads_workspaceId_idx" ON "workspace_uploads"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_uploads_orgId_type_idx" ON "workspace_uploads"("orgId", "type");

-- CreateIndex
CREATE INDEX "workspace_comments_workspaceId_idx" ON "workspace_comments"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_comments_taskId_idx" ON "workspace_comments"("taskId");

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

-- CreateIndex
CREATE INDEX "send_window_stats_orgId_idx" ON "send_window_stats"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "send_window_stats_orgId_hourBucket_key" ON "send_window_stats"("orgId", "hourBucket");

-- CreateIndex
CREATE UNIQUE INDEX "agent_budgets_orgId_key" ON "agent_budgets"("orgId");

-- CreateIndex
CREATE INDEX "agent_cache_orgId_agentName_idx" ON "agent_cache"("orgId", "agentName");

-- CreateIndex
CREATE INDEX "agent_cache_createdAt_idx" ON "agent_cache"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_cache_orgId_keyHash_key" ON "agent_cache"("orgId", "keyHash");

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

-- CreateIndex
CREATE INDEX "marketing_plans_orgId_platform_idx" ON "marketing_plans"("orgId", "platform");

-- CreateIndex
CREATE INDEX "marketing_plans_orgId_status_idx" ON "marketing_plans"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_plans_orgId_day_key" ON "marketing_plans"("orgId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "social_integrations_orgId_key" ON "social_integrations"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "publication_logs_marketingPlanId_key" ON "publication_logs"("marketingPlanId");

-- CreateIndex
CREATE INDEX "publication_logs_orgId_status_idx" ON "publication_logs"("orgId", "status");

-- CreateIndex
CREATE INDEX "publication_logs_orgId_platform_idx" ON "publication_logs"("orgId", "platform");

-- CreateIndex
CREATE INDEX "repurpose_artifacts_orgId_sourceMarketingPlanId_idx" ON "repurpose_artifacts"("orgId", "sourceMarketingPlanId");

-- CreateIndex
CREATE INDEX "repurpose_artifacts_orgId_status_idx" ON "repurpose_artifacts"("orgId", "status");

-- CreateIndex
CREATE INDEX "repurpose_runs_orgId_idx" ON "repurpose_runs"("orgId");

-- CreateIndex
CREATE INDEX "proof_assets_orgId_status_idx" ON "proof_assets"("orgId", "status");

-- CreateIndex
CREATE INDEX "proof_assets_orgId_type_idx" ON "proof_assets"("orgId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "proof_assets_orgId_workspaceId_type_anonLevel_key" ON "proof_assets"("orgId", "workspaceId", "type", "anonLevel");

-- CreateIndex
CREATE UNIQUE INDEX "proof_stat_snapshots_orgId_key" ON "proof_stat_snapshots"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_packets_execSlug_key" ON "deal_packets"("execSlug");

-- CreateIndex
CREATE INDEX "deal_packets_orgId_status_idx" ON "deal_packets"("orgId", "status");

-- CreateIndex
CREATE INDEX "deal_packets_orgId_tier_idx" ON "deal_packets"("orgId", "tier");

-- CreateIndex
CREATE INDEX "deal_packets_orgId_assessmentId_idx" ON "deal_packets"("orgId", "assessmentId");

-- CreateIndex
CREATE INDEX "deal_signals_orgId_assessmentId_createdAt_idx" ON "deal_signals"("orgId", "assessmentId", "createdAt");

-- CreateIndex
CREATE INDEX "deal_signals_orgId_type_idx" ON "deal_signals"("orgId", "type");

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

-- CreateIndex
CREATE INDEX "profit_leaks_orgId_kind_severity_status_createdAt_idx" ON "profit_leaks"("orgId", "kind", "severity", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "profit_leak_snapshots_orgId_window_key" ON "profit_leak_snapshots"("orgId", "window");

-- CreateIndex
CREATE UNIQUE INDEX "exec_packs_publicSlug_key" ON "exec_packs"("publicSlug");

-- CreateIndex
CREATE INDEX "exec_packs_orgId_generatedAt_idx" ON "exec_packs"("orgId", "generatedAt");

-- CreateIndex
CREATE INDEX "build_templates_orgId_key_idx" ON "build_templates"("orgId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "build_templates_orgId_key_version_key" ON "build_templates"("orgId", "key", "version");

-- CreateIndex
CREATE INDEX "build_runs_orgId_status_createdAt_idx" ON "build_runs"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "build_artifacts_orgId_buildRunId_type_version_idx" ON "build_artifacts"("orgId", "buildRunId", "type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "system_events_dedupeKey_key" ON "system_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "system_events_organizationId_createdAt_idx" ON "system_events"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "system_events_organizationId_type_idx" ON "system_events"("organizationId", "type");

-- CreateIndex
CREATE INDEX "strategic_insights_organizationId_status_category_idx" ON "strategic_insights"("organizationId", "status", "category");

-- CreateIndex
CREATE INDEX "growth_signals_organizationId_type_idx" ON "growth_signals"("organizationId", "type");

-- CreateIndex
CREATE INDEX "benchmark_segments_industry_sizeBand_plan_timeWindow_period_idx" ON "benchmark_segments"("industry", "sizeBand", "plan", "timeWindow", "periodEnd");

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

-- CreateIndex
CREATE INDEX "strategy_recommendations_organizationId_status_impactScore_idx" ON "strategy_recommendations"("organizationId", "status", "impactScore");

-- CreateIndex
CREATE INDEX "experiment_plans_organizationId_status_idx" ON "experiment_plans"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "offers_publishedSlug_key" ON "offers"("publishedSlug");

-- CreateIndex
CREATE INDEX "offers_organizationId_status_idx" ON "offers"("organizationId", "status");

-- CreateIndex
CREATE INDEX "offer_assets_offerId_type_idx" ON "offer_assets"("offerId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "sales_assignments_organizationId_entityType_entityId_key" ON "sales_assignments"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "performance_snapshots_organizationId_window_idx" ON "performance_snapshots"("organizationId", "window");

-- CreateIndex
CREATE INDEX "playbooks_organizationId_status_idx" ON "playbooks"("organizationId", "status");

-- CreateIndex
CREATE INDEX "playbook_runs_organizationId_status_createdAt_idx" ON "playbook_runs"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "playbook_approvals_playbookRunId_key" ON "playbook_approvals"("playbookRunId");

-- CreateIndex
CREATE INDEX "playbook_approvals_organizationId_status_idx" ON "playbook_approvals"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_usage_snapshots" ADD CONSTRAINT "monthly_usage_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roi_projections" ADD CONSTRAINT "roi_projections_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_reports" ADD CONSTRAINT "artifact_reports_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presales_artifacts" ADD CONSTRAINT "presales_artifacts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "implementation_tasks" ADD CONSTRAINT "implementation_tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "client_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_checklist_items" ADD CONSTRAINT "integration_checklist_items_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "client_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_uploads" ADD CONSTRAINT "workspace_uploads_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "client_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_comments" ADD CONSTRAINT "workspace_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "implementation_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_comments" ADD CONSTRAINT "workspace_comments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "client_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "lead_sequences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_draft_links" ADD CONSTRAINT "proposal_draft_links_meetingSessionId_fkey" FOREIGN KEY ("meetingSessionId") REFERENCES "meeting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_performances" ADD CONSTRAINT "meeting_performances_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "meeting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_signals" ADD CONSTRAINT "deal_signals_dealPacketId_fkey" FOREIGN KEY ("dealPacketId") REFERENCES "deal_packets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_sequences" ADD CONSTRAINT "outbound_sequences_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "outbound_sequences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_artifacts" ADD CONSTRAINT "build_artifacts_buildRunId_fkey" FOREIGN KEY ("buildRunId") REFERENCES "build_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_snapshots" ADD CONSTRAINT "benchmark_snapshots_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "benchmark_segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retrieval_logs" ADD CONSTRAINT "retrieval_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ai_chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_users" ADD CONSTRAINT "whatsapp_users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_reps" ADD CONSTRAINT "sales_reps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_reps" ADD CONSTRAINT "sales_reps_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "sales_reps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "sales_reps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_commissionRuleId_fkey" FOREIGN KEY ("commissionRuleId") REFERENCES "commission_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "sales_reps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_opt_ins" ADD CONSTRAINT "whatsapp_opt_ins_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "whatsapp_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_campaign_sends" ADD CONSTRAINT "whatsapp_campaign_sends_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_campaign_sends" ADD CONSTRAINT "whatsapp_campaign_sends_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatsapp_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_assets" ADD CONSTRAINT "offer_assets_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_assignments" ADD CONSTRAINT "sales_assignments_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "sales_reps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_snapshots" ADD CONSTRAINT "performance_snapshots_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "sales_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_runs" ADD CONSTRAINT "playbook_runs_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "playbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
