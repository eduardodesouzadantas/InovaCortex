import type { Role } from "@/lib/auth/rbac";

export type WhatsAppPipelineActorSource =
    | "tenant_user"
    | "whatsapp_actor"
    | "system"
    | "webhook";

export type WhatsAppMessageDirection = "inbound" | "outbound";
export type WhatsAppSendType = "text" | "template";
export type WhatsAppMessageLifecycleStatus = "queued" | "accepted" | "sent" | "delivered" | "read" | "failed";
export type WhatsAppMessageFailureClass = "retryable" | "terminal" | "unknown";
export type WhatsAppRetryJobType = "whatsapp_retry_message";

export interface WhatsAppPipelineTenantContext {
    organizationId: string;
    orgSlug: string | null;
    phoneNumberId?: string | null;
}

export interface WhatsAppPipelineActor {
    source: WhatsAppPipelineActorSource;
    userId: string | null;
    role: Role | "sales" | "ceo" | "system";
    phoneNumber: string | null;
}

export interface WhatsAppContactSnapshot {
    id: string;
    organizationId: string;
    phoneNumberE164: string;
    name: string | null;
    optedOutAt: Date | null;
    sessionWindowUntil: Date | null;
    lastInboundAt: Date | null;
    lastOutboundAt: Date | null;
    lastMessageAt: Date | null;
}

export interface WhatsAppConversationSnapshot {
    id: string;
    organizationId: string;
    contactId: string;
    assignedUserId: string | null;
    status: string;
    unreadCount: number;
    lastMessageAt: Date | null;
    lastMessagePreview: string | null;
    slaDueAt: Date | null;
}

export interface WhatsAppMessageSnapshot {
    id: string;
    organizationId: string;
    conversationId: string;
    contactId: string;
    externalMessageId: string | null;
    direction: WhatsAppMessageDirection;
    type: string;
    text: string | null;
    status: string;
    sentAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
    failedAt: Date | null;
    createdAt: Date;
}

export interface WhatsAppMessageLifecycleEvent {
    externalMessageId: string;
    providerStatus: string;
    lifecycleStatus: WhatsAppMessageLifecycleStatus | null;
    eventAt: Date | null;
    failureClass: WhatsAppMessageFailureClass | null;
    payloadJson: string;
}

export interface WhatsAppRetryDecision {
    eligible: boolean;
    delaySeconds: number | null;
    reason: string | null;
}

export interface WhatsAppRetryQueuePayload {
    jobType: WhatsAppRetryJobType;
    organizationId: string;
    messageRecordId: string;
    sourceExternalMessageId: string | null;
    sourceStatus: string | null;
    failureClass: WhatsAppMessageFailureClass | null;
    queuedAt: string;
    delaySeconds: number | null;
    reason: string | null;
}

export interface WhatsAppRetryExecutionResult {
    queueId: string | null;
    queued: boolean;
    state: "not_applicable" | "scheduled" | "duplicate_pending" | "executed" | "requeued" | "terminal_failure" | "stale" | "skipped";
    scheduledFor: string | null;
    reason: string | null;
}

export interface WhatsAppDealLink {
    dealId: string | null;
    pipelineId: string | null;
    stageId: string | null;
    created: boolean;
    reused: boolean;
    activityIds: string[];
    messageActivityId: string | null;
    dealCreatedActivityId: string | null;
}

export interface WhatsAppSideEffectPlan {
    synchronous: string[];
    asyncCandidates: string[];
}

export interface WhatsAppMessageStatusReconciliationResult {
    outcome: "applied" | "duplicate" | "ignored_out_of_order" | "ignored_stale_attempt" | "invalid" | "message_not_found" | "legacy_log_updated";
    organizationId: string | null;
    messageRecordId: string | null;
    externalMessageId: string | null;
    previousStatus: string | null;
    nextStatus: string | null;
    lifecycleStatus: WhatsAppMessageLifecycleStatus | null;
    failureClass: WhatsAppMessageFailureClass | null;
    reason: string | null;
    retryDecision: WhatsAppRetryDecision;
    retryExecution: WhatsAppRetryExecutionResult;
    sideEffects: WhatsAppSideEffectPlan;
}

export interface InboundWhatsAppPipelineResult {
    tenant: WhatsAppPipelineTenantContext;
    actor: WhatsAppPipelineActor;
    contact: WhatsAppContactSnapshot;
    conversation: WhatsAppConversationSnapshot;
    message: WhatsAppMessageSnapshot;
    deal: WhatsAppDealLink;
    sideEffects: WhatsAppSideEffectPlan;
    isNewMessage: boolean;
}

export interface OutboundWhatsAppPipelineResult {
    tenant: WhatsAppPipelineTenantContext;
    actor: WhatsAppPipelineActor;
    contact: WhatsAppContactSnapshot;
    conversation: WhatsAppConversationSnapshot;
    message: WhatsAppMessageSnapshot;
    deal: WhatsAppDealLink;
    sideEffects: WhatsAppSideEffectPlan;
}
