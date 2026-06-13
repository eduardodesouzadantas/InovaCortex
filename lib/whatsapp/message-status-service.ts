import { createSystemEvent } from "@/lib/system-events";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import {
    appendLedgerEvent,
    hasKnownExternalMessageId,
    readMessageMetadataEnvelope,
    setCurrentLedgerState,
    updateMessageMetadataEnvelope,
} from "./message-ledger";
import { reconcileLegacyMessageLog } from "./legacy-message-log-adapter";
import { enqueueWhatsAppRetry } from "./retry-service";

import type {
    WhatsAppMessageFailureClass,
    WhatsAppMessageLifecycleEvent,
    WhatsAppMessageLifecycleStatus,
    WhatsAppMessageStatusReconciliationResult,
    WhatsAppRetryDecision,
    WhatsAppRetryExecutionResult,
} from "./pipeline-contract";

type MetaStatusError = {
    code?: number;
    title?: string;
    message?: string;
    error_data?: {
        details?: string;
    };
};

type MetaStatusPayload = {
    id?: string;
    status?: string;
    timestamp?: string;
    recipient_id?: string;
    errors?: MetaStatusError[];
    conversation?: {
        id?: string;
        expiration_timestamp?: string;
        origin?: {
            type?: string;
        };
    };
    pricing?: {
        billable?: boolean;
        pricing_model?: string;
        category?: string;
    };
};

type ReconciliationMessageRecord = {
    id: string;
    organizationId: string;
    messageId: string | null;
    status: string;
    errorJson: string | null;
    sentAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
    failedAt: Date | null;
    createdAt: Date | null;
};

const STATUS_PRIORITY: Record<WhatsAppMessageLifecycleStatus, number> = {
    queued: 10,
    accepted: 15,
    sent: 20,
    failed: 30,
    delivered: 40,
    read: 50,
};

const RETRYABLE_ERROR_CODES = new Set([
    1,
    2,
    4,
    17,
    32,
    341,
    130429,
    131016,
    131048,
    131056,
]);

function safeJson(value: unknown): string {
    try {
        return JSON.stringify(value ?? {});
    } catch {
        return "{}";
    }
}

function normalizeStatus(rawStatus: unknown): WhatsAppMessageLifecycleStatus | null {
    switch (typeof rawStatus === "string" ? rawStatus.toLowerCase() : "") {
        case "queued":
            return "queued";
        case "accepted":
            return "accepted";
        case "sent":
            return "sent";
        case "delivered":
            return "delivered";
        case "read":
            return "read";
        case "failed":
            return "failed";
        default:
            return null;
    }
}

function parseEventDate(rawTimestamp: unknown): Date | null {
    if (typeof rawTimestamp !== "string" || rawTimestamp.trim().length === 0) {
        return null;
    }

    const numeric = Number.parseInt(rawTimestamp, 10);
    if (Number.isFinite(numeric) && numeric > 0) {
        return new Date(numeric * 1000);
    }

    const parsed = new Date(rawTimestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function classifyFailure(errors: MetaStatusError[]): WhatsAppMessageFailureClass {
    if (errors.length === 0) {
        return "unknown";
    }

    const retryable = errors.some((error) => {
        if (typeof error.code === "number" && RETRYABLE_ERROR_CODES.has(error.code)) {
            return true;
        }

        const haystack = [
            error.title,
            error.message,
            error.error_data?.details,
        ]
            .filter((value): value is string => typeof value === "string")
            .join(" ")
            .toLowerCase();

        return haystack.includes("rate limit")
            || haystack.includes("temporar")
            || haystack.includes("timeout")
            || haystack.includes("unavailable")
            || haystack.includes("try again");
    });

    return retryable ? "retryable" : "terminal";
}

function resolveCurrentLifecycle(message: {
    status: string;
    sentAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
    failedAt: Date | null;
}): WhatsAppMessageLifecycleStatus | null {
    if (message.readAt) return "read";
    if (message.deliveredAt) return "delivered";
    if (message.failedAt) return "failed";
    return normalizeStatus(message.status);
}

function getRecordedAt(
    message: {
        sentAt: Date | null;
        deliveredAt: Date | null;
        readAt: Date | null;
        failedAt: Date | null;
        createdAt?: Date | null;
    },
    status: WhatsAppMessageLifecycleStatus,
): Date | null {
    switch (status) {
        case "queued":
        case "accepted":
        case "sent":
            return message.sentAt ?? message.createdAt ?? null;
        case "delivered":
            return message.deliveredAt;
        case "read":
            return message.readAt;
        case "failed":
            return message.failedAt;
    }
}

function buildRetryDecision(failureClass: WhatsAppMessageFailureClass | null): WhatsAppRetryDecision {
    if (failureClass === "retryable") {
        return {
            eligible: true,
            delaySeconds: 300,
            reason: "TRANSIENT_PROVIDER_FAILURE",
        };
    }

    if (failureClass === "terminal") {
        return {
            eligible: false,
            delaySeconds: null,
            reason: "TERMINAL_PROVIDER_FAILURE",
        };
    }

    return {
        eligible: false,
        delaySeconds: null,
        reason: null,
    };
}

function buildRetryExecutionResult(
    result: Partial<WhatsAppRetryExecutionResult> = {},
): WhatsAppRetryExecutionResult {
    return {
        queueId: result.queueId ?? null,
        queued: result.queued ?? false,
        state: result.state ?? "not_applicable",
        scheduledFor: result.scheduledFor ?? null,
        reason: result.reason ?? null,
    };
}

function buildSideEffectPlan(input: {
    outcome: WhatsAppMessageStatusReconciliationResult["outcome"];
    retryEligible: boolean;
    retryState: WhatsAppRetryExecutionResult["state"];
}) {
    if (input.outcome !== "applied") {
        return {
            synchronous: ["status_event_classification", "idempotency_check"],
            asyncCandidates: [],
        };
    }

    return {
        synchronous: [
            "status_event_classification",
            "message_status_reconciliation",
            "observability_event",
        ],
        asyncCandidates: [
            ...(input.retryEligible || input.retryState === "scheduled" || input.retryState === "duplicate_pending"
                ? ["whatsapp_retry_dispatch"]
                : []),
            "analytics_rollup",
            "delivery_alerts",
            "sla_recalculation",
        ],
    };
}

function buildBaseResult(input: {
    outcome: WhatsAppMessageStatusReconciliationResult["outcome"];
    organizationId?: string | null;
    messageRecordId?: string | null;
    externalMessageId?: string | null;
    previousStatus?: string | null;
    nextStatus?: string | null;
    lifecycleStatus?: WhatsAppMessageLifecycleStatus | null;
    failureClass?: WhatsAppMessageFailureClass | null;
    reason?: string | null;
    retryDecision?: WhatsAppRetryDecision;
    retryExecution?: WhatsAppRetryExecutionResult;
}): WhatsAppMessageStatusReconciliationResult {
    const retryDecision = input.retryDecision ?? buildRetryDecision(input.failureClass ?? null);
    const retryExecution = input.retryExecution ?? buildRetryExecutionResult();

    return {
        outcome: input.outcome,
        organizationId: input.organizationId ?? null,
        messageRecordId: input.messageRecordId ?? null,
        externalMessageId: input.externalMessageId ?? null,
        previousStatus: input.previousStatus ?? null,
        nextStatus: input.nextStatus ?? null,
        lifecycleStatus: input.lifecycleStatus ?? null,
        failureClass: input.failureClass ?? null,
        reason: input.reason ?? null,
        retryDecision,
        retryExecution,
        sideEffects: buildSideEffectPlan({
            outcome: input.outcome,
            retryEligible: retryDecision.eligible,
            retryState: retryExecution.state,
        }),
    };
}

export function parseMetaStatusEvent(payload: unknown): WhatsAppMessageLifecycleEvent | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    const statusPayload = payload as MetaStatusPayload;
    if (typeof statusPayload.id !== "string" || statusPayload.id.trim().length === 0) {
        return null;
    }

    const lifecycleStatus = normalizeStatus(statusPayload.status);
    const errors = Array.isArray(statusPayload.errors) ? statusPayload.errors : [];

    return {
        externalMessageId: statusPayload.id,
        providerStatus: typeof statusPayload.status === "string" ? statusPayload.status : "unknown",
        lifecycleStatus,
        eventAt: parseEventDate(statusPayload.timestamp),
        failureClass: lifecycleStatus === "failed" ? classifyFailure(errors) : null,
        payloadJson: safeJson(statusPayload),
    };
}

function buildUpdateData(input: {
    lifecycleEvent: WhatsAppMessageLifecycleEvent;
    eventAt: Date;
    existingErrorJson: string | null;
    currentMessageId: string | null;
}): {
    status: string;
    metaStatusPayload: string;
    errorJson: string;
    sentAt?: Date;
    deliveredAt?: Date;
    readAt?: Date;
    failedAt?: Date;
} {
    const base = {
        status: input.lifecycleEvent.lifecycleStatus ?? input.lifecycleEvent.providerStatus,
        metaStatusPayload: input.lifecycleEvent.payloadJson,
    };

    const errorJson = updateMessageMetadataEnvelope(input.existingErrorJson, (envelope) => {
        appendLedgerEvent(envelope.ledger, {
            at: input.eventAt,
            source: "provider_webhook",
            externalMessageId: input.lifecycleEvent.externalMessageId,
            lifecycleStatus: input.lifecycleEvent.lifecycleStatus ?? input.lifecycleEvent.providerStatus,
            providerStatus: input.lifecycleEvent.providerStatus,
            failureClass: input.lifecycleEvent.failureClass,
            note: "provider_status_reconciled",
        });
        setCurrentLedgerState(envelope.ledger, {
            lifecycleStatus: input.lifecycleEvent.lifecycleStatus ?? input.lifecycleEvent.providerStatus,
            failureClass: input.lifecycleEvent.failureClass,
            externalMessageId: input.lifecycleEvent.externalMessageId ?? input.currentMessageId,
            eventAt: input.eventAt,
        });
        envelope.ledger.retry.lastDecision = buildRetryDecision(input.lifecycleEvent.failureClass);
        return envelope;
    });

    switch (input.lifecycleEvent.lifecycleStatus) {
        case "queued":
        case "accepted":
        case "sent":
            return {
                ...base,
                sentAt: input.eventAt,
                errorJson,
            };
        case "delivered":
            return {
                ...base,
                deliveredAt: input.eventAt,
                errorJson,
            };
        case "read":
            return {
                ...base,
                readAt: input.eventAt,
                errorJson,
            };
        case "failed":
            return {
                ...base,
                failedAt: input.eventAt,
                errorJson,
            };
        default:
            return {
                ...base,
                errorJson,
            };
    }
}

async function resolveMessageRecord(
    externalMessageId: string,
): Promise<{
    message: ReconciliationMessageRecord | null;
    matchedHistoricalId: boolean;
}> {
    const direct = await prisma.whatsAppMessage.findUnique({
        where: { messageId: externalMessageId },
        select: {
            id: true,
            organizationId: true,
            messageId: true,
            status: true,
            errorJson: true,
            sentAt: true,
            deliveredAt: true,
            readAt: true,
            failedAt: true,
            createdAt: true,
        },
    });

    if (direct) {
        return {
            message: direct,
            matchedHistoricalId: false,
        };
    }

    const historical = await prisma.whatsAppMessage.findFirst({
        where: {
            errorJson: { contains: externalMessageId },
        },
        select: {
            id: true,
            organizationId: true,
            messageId: true,
            status: true,
            errorJson: true,
            sentAt: true,
            deliveredAt: true,
            readAt: true,
            failedAt: true,
            createdAt: true,
        },
    });

    if (!historical) {
        return {
            message: null,
            matchedHistoricalId: false,
        };
    }

    const envelope = readMessageMetadataEnvelope(historical.errorJson);
    if (!hasKnownExternalMessageId(envelope.ledger, externalMessageId)) {
        return {
            message: null,
            matchedHistoricalId: false,
        };
    }

    return {
        message: historical,
        matchedHistoricalId: true,
    };
}

export async function reconcileMetaMessageStatusEvent(payload: unknown): Promise<WhatsAppMessageStatusReconciliationResult> {
    const lifecycleEvent = parseMetaStatusEvent(payload);
    if (!lifecycleEvent || !lifecycleEvent.lifecycleStatus) {
        return buildBaseResult({
            outcome: "invalid",
            externalMessageId: lifecycleEvent?.externalMessageId ?? null,
            lifecycleStatus: lifecycleEvent?.lifecycleStatus ?? null,
            failureClass: lifecycleEvent?.failureClass ?? null,
            reason: "INVALID_OR_UNKNOWN_PROVIDER_STATUS",
        });
    }

    const resolved = await resolveMessageRecord(lifecycleEvent.externalMessageId);
    if (!resolved.message) {
        const legacyUpdated = await reconcileLegacyMessageLog(lifecycleEvent.externalMessageId, lifecycleEvent);
        return buildBaseResult({
            outcome: legacyUpdated ? "legacy_log_updated" : "message_not_found",
            externalMessageId: lifecycleEvent.externalMessageId,
            lifecycleStatus: lifecycleEvent.lifecycleStatus,
            failureClass: lifecycleEvent.failureClass,
            reason: legacyUpdated ? "LEGACY_MESSAGE_LOG_UPDATED" : "MESSAGE_NOT_FOUND",
        });
    }

    const message = resolved.message;
    const envelope = readMessageMetadataEnvelope(message.errorJson);
    if (
        resolved.matchedHistoricalId
        && envelope.ledger.currentExternalMessageId
        && envelope.ledger.currentExternalMessageId !== lifecycleEvent.externalMessageId
    ) {
        return buildBaseResult({
            outcome: "ignored_stale_attempt",
            organizationId: message.organizationId,
            messageRecordId: message.id,
            externalMessageId: lifecycleEvent.externalMessageId,
            previousStatus: envelope.ledger.currentStatus ?? message.status,
            nextStatus: envelope.ledger.currentStatus ?? message.status,
            lifecycleStatus: lifecycleEvent.lifecycleStatus,
            failureClass: lifecycleEvent.failureClass,
            reason: "STATUS_EVENT_FOR_SUPERSEDED_ATTEMPT",
        });
    }

    const previousLifecycle = resolveCurrentLifecycle(message);
    const previousStatus = previousLifecycle ?? message.status;
    const previousRank = previousLifecycle ? STATUS_PRIORITY[previousLifecycle] : 0;
    const incomingRank = STATUS_PRIORITY[lifecycleEvent.lifecycleStatus];
    const eventAt = lifecycleEvent.eventAt ?? new Date();
    const recordedAt = getRecordedAt(message, lifecycleEvent.lifecycleStatus);

    if (previousLifecycle === lifecycleEvent.lifecycleStatus && recordedAt && eventAt.getTime() <= recordedAt.getTime()) {
        return buildBaseResult({
            outcome: "duplicate",
            organizationId: message.organizationId,
            messageRecordId: message.id,
            externalMessageId: lifecycleEvent.externalMessageId,
            previousStatus,
            nextStatus: previousStatus,
            lifecycleStatus: lifecycleEvent.lifecycleStatus,
            failureClass: lifecycleEvent.failureClass,
            reason: "DUPLICATE_STATUS_EVENT",
        });
    }

    if (incomingRank < previousRank) {
        return buildBaseResult({
            outcome: "ignored_out_of_order",
            organizationId: message.organizationId,
            messageRecordId: message.id,
            externalMessageId: lifecycleEvent.externalMessageId,
            previousStatus,
            nextStatus: previousStatus,
            lifecycleStatus: lifecycleEvent.lifecycleStatus,
            failureClass: lifecycleEvent.failureClass,
            reason: "OUT_OF_ORDER_STATUS_EVENT",
        });
    }

    const nextStatus = lifecycleEvent.lifecycleStatus;
    await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: buildUpdateData({
            lifecycleEvent,
            eventAt,
            existingErrorJson: message.errorJson,
            currentMessageId: message.messageId,
        }),
    });

    const retryDecision = buildRetryDecision(lifecycleEvent.failureClass);
    let retryExecution = buildRetryExecutionResult();
    if (nextStatus === "failed" && retryDecision.eligible) {
        try {
            retryExecution = await enqueueWhatsAppRetry({
                organizationId: message.organizationId,
                messageRecordId: message.id,
                sourceExternalMessageId: lifecycleEvent.externalMessageId,
                sourceStatus: nextStatus,
                failureClass: lifecycleEvent.failureClass,
                delaySeconds: retryDecision.delaySeconds,
                reason: retryDecision.reason,
            });
        } catch (error) {
            logger.error("WhatsApp retry scheduling failed", {
                organizationId: message.organizationId,
                messageRecordId: message.id,
                externalMessageId: lifecycleEvent.externalMessageId,
                error: error instanceof Error ? error.message : String(error),
            });
            retryExecution = buildRetryExecutionResult({
                state: "skipped",
                reason: "RETRY_PIPELINE_ERROR",
            });
        }
    }

    const severity = lifecycleEvent.lifecycleStatus === "failed"
        ? lifecycleEvent.failureClass === "retryable" ? "warn" : "error"
        : "info";

    await createSystemEvent({
        organizationId: message.organizationId,
        type: "whatsapp_status_reconciled",
        severity,
        message: `WhatsApp message status ${nextStatus}`,
        entityType: "whatsapp_message",
        entityId: message.id,
        payloadJson: safeJson({
            externalMessageId: lifecycleEvent.externalMessageId,
            previousStatus,
            nextStatus,
            failureClass: lifecycleEvent.failureClass,
            retryDecision,
            retryExecution,
            eventAt: eventAt.toISOString(),
        }),
        dedupeKey: `whatsapp_status_reconciled:${message.id}:${nextStatus}:${eventAt.toISOString()}`,
    }).catch((error: unknown) => {
        logger.error("WhatsApp message status event creation failed", {
            messageId: message.id,
            externalMessageId: lifecycleEvent.externalMessageId,
            error: error instanceof Error ? error.message : String(error),
        });
    });

    return buildBaseResult({
        outcome: "applied",
        organizationId: message.organizationId,
        messageRecordId: message.id,
        externalMessageId: lifecycleEvent.externalMessageId,
        previousStatus,
        nextStatus,
        lifecycleStatus: lifecycleEvent.lifecycleStatus,
        failureClass: lifecycleEvent.failureClass,
        reason: previousLifecycle === lifecycleEvent.lifecycleStatus ? "STATUS_TIMESTAMP_REFRESHED" : "STATUS_APPLIED",
        retryDecision,
        retryExecution,
    });
}
