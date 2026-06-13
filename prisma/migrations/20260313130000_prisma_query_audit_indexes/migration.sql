CREATE INDEX IF NOT EXISTS "monthly_usage_snapshots_organizationId_updatedAt_idx"
ON "monthly_usage_snapshots"("organizationId", "updatedAt");

CREATE INDEX IF NOT EXISTS "alert_events_organizationId_resolved_createdAt_idx"
ON "alert_events"("organizationId", "resolved", "createdAt");

CREATE INDEX IF NOT EXISTS "meeting_sessions_organizationId_startAt_idx"
ON "meeting_sessions"("organizationId", "startAt");

CREATE INDEX IF NOT EXISTS "meeting_sessions_assessmentId_startAt_idx"
ON "meeting_sessions"("assessmentId", "startAt");

CREATE INDEX IF NOT EXISTS "meeting_sessions_organizationId_updatedAt_idx"
ON "meeting_sessions"("organizationId", "updatedAt");

CREATE INDEX IF NOT EXISTS "meeting_performances_organizationId_outcome_createdAt_idx"
ON "meeting_performances"("organizationId", "outcome", "createdAt");

CREATE INDEX IF NOT EXISTS "profit_leaks_orgId_status_updatedAt_idx"
ON "profit_leaks"("orgId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "system_events_organizationId_severity_createdAt_idx"
ON "system_events"("organizationId", "severity", "createdAt");

CREATE INDEX IF NOT EXISTS "contacts_organizationId_lastMessageAt_idx"
ON "contacts"("organizationId", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "whatsapp_conversations_organizationId_assignedUserId_idx"
ON "whatsapp_conversations"("organizationId", "assignedUserId");

CREATE INDEX IF NOT EXISTS "whatsapp_conversations_organizationId_status_assignedUserId_idx"
ON "whatsapp_conversations"("organizationId", "status", "assignedUserId");

CREATE INDEX IF NOT EXISTS "whatsapp_conversations_organizationId_status_lastMessageAt_idx"
ON "whatsapp_conversations"("organizationId", "status", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "whatsapp_templates_organizationId_name_idx"
ON "whatsapp_templates"("organizationId", "name");

CREATE INDEX IF NOT EXISTS "whatsapp_campaigns_organizationId_createdAt_idx"
ON "whatsapp_campaigns"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "whatsapp_campaign_sends_campaignId_status_idx"
ON "whatsapp_campaign_sends"("campaignId", "status");

CREATE INDEX IF NOT EXISTS "whatsapp_campaign_sends_campaignId_status_sentAt_idx"
ON "whatsapp_campaign_sends"("campaignId", "status", "sentAt");

CREATE INDEX IF NOT EXISTS "sales_reps_organizationId_active_role_idx"
ON "sales_reps"("organizationId", "active", "role");

CREATE INDEX IF NOT EXISTS "lead_assignments_salesRepId_status_idx"
ON "lead_assignments"("salesRepId", "status");

CREATE INDEX IF NOT EXISTS "sales_assignments_organizationId_salesRepId_entityType_idx"
ON "sales_assignments"("organizationId", "salesRepId", "entityType");

CREATE INDEX IF NOT EXISTS "performance_snapshots_organizationId_window_createdAt_idx"
ON "performance_snapshots"("organizationId", "window", "createdAt");
