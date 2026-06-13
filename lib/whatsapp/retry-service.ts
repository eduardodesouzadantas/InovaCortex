import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { createSystemEvent } from "@/lib/system-events";

import {
    appendLedgerEvent,
    readMessageMetadataEnvelope,
    updateMessageMetadataEnvelope,
    upsertRetryJobRecord,
} from "./message-ledger";

import type {
    WhatsAppMessageFailureClass,
    WhatsAppRetryExecutionResult,
    WhatsAppRetryQueuePayload,
    WhatsAppSendType,
} from "./pipeline-contract";

export const WHATSAPP_RETRY_QUEUE_TYPE = "whatsapp_retry_message";
export const WHATSAPP_RETRY_ENTITY_TYPE = "whatsapp_message";
export const WHATSAPP_RETRY_SCHEDULER_JOB = "whatsapp_retry_dispatch";
export const WHATSAPP_MAX_RETRY_ATTEMPTS = 3;

type RetryableOutboundDescriptor =
    | { type: "text"; text: string }
    | { type: "template"; templateName: string; templateLanguage: string };

type JsonRecord = Record<string, unknown>;

type RetryQueueLookup = {
    id: string;
    nextRetryAt: Date | null;
};

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function readOutboundRequest(metadata: JsonRecord): RetryableOutboundDescriptor | null {
    const outboundRequest = metadata.outboundRequest;
    if (isRecord(outboundRequest)) {
        const type = normalizeString(outboundRequest.type);
        if (type === "template") {
            const templateName = normalizeString(outboundRequest.templateName);
            const templateLanguage = normalizeString(outboundRequest.templateLanguage);
            if (templateName && templateLanguage) {
                return {
                    type: "template",
                    templateName,
                    templateLanguage,
                };
            }
        }

        if (type === "text") {
            const text = normalizeString(outboundRequest.text);
            if (text) {
                return { type: "text", text };
            }
        }
    }

    const templateName = normalizeString(metadata.templateName);
    const templateLanguage = normalizeString(metadata.templateLanguage);
    if (templateName && templateLanguage) {
        return {
            type: "template",
            templateName,
            templateLanguage,
        };
    }

    return null;
}

export function resolveRetryableOutboundDescriptor(input: {
    type: string;
    text: string | null;
    errorJson: string | null;
}): RetryableOutboundDescriptor | null {
    const envelope = readMessageMetadataEnvelope(input.errorJson);
    const fromMetadata = readOutboundRequest(envelope.metadata);
    if (fromMetadata) {
        return fromMetadata;
    }

    if ((input.type as WhatsAppSendType) === "text") {
        const text = normalizeString(input.text);
        return text ? { type: "text", text } : null;
    }

    return null;
}

export function classifyRetryExecutionFailure(error: string | null | undefined): {
    failureClass: WhatsAppMessageFailureClass;
    code: string;
} {
    const raw = normalizeString(error) ?? "UNKNOWN";
    const normalized = raw.toLowerCase();

    if ([
        "meta_not_configured",
        "template_not_approved",
        "template_name_language_not_found",
        "forbidden",
        "unauthorized",
        "permission",
        "invalid",
        "opted_out",
        "outside_24h_window",
    ].some((token) => normalized.includes(token))) {
        return {
            failureClass: "terminal",
            code: raw,
        };
    }

    if ([
        "timeout",
        "temporar",
        "rate limit",
        "http_5",
        "network",
        "socket",
        "unavailable",
        "try again",
    ].some((token) => normalized.includes(token))) {
        return {
            failureClass: "retryable",
            code: raw,
        };
    }

    return {
        failureClass: "unknown",
        code: raw,
    };
}

export function computeRetryDelaySeconds(attempts: number): number {
    const safeAttempts = Math.max(1, Math.floor(attempts));
    return Math.min(30 * 60, 5 * 60 * (2 ** (safeAttempts - 1)));
}

function buildRetryPayload(input: {
    organizationId: string;
    messageRecordId: string;
    sourceExternalMessageId: string | null;
    sourceStatus: string | null;
    failureClass: WhatsAppMessageFailureClass | null;
    delaySeconds: number | null;
    reason: string | null;
    queuedAt: Date;
}): WhatsAppRetryQueuePayload {
    return {
        jobType: "whatsapp_retry_message",
        organizationId: input.organizationId,
        messageRecordId: input.messageRecordId,
        sourceExternalMessageId: input.sourceExternalMessageId,
        sourceStatus: input.sourceStatus,
        failureClass: input.failureClass,
        delaySeconds: input.delaySeconds,
        reason: input.reason,
        queuedAt: input.queuedAt.toISOString(),
    };
}

async function triggerRetryWorker(organizationId: string): Promise<void> {
    const { enqueueSystemSchedulerJobs, triggerSystemSchedulerWorker } = await import("@/workers/system-scheduler");

    await enqueueSystemSchedulerJobs({
        queueOrganizationId: organizationId,
        orgId: organizationId,
        jobs: [WHATSAPP_RETRY_SCHEDULER_JOB],
        triggeredBy: "worker",
    });

    await triggerSystemSchedulerWorker();
}

async function findPendingRetryQueueItem(organizationId: string, messageRecordId: string): Promise<RetryQueueLookup | null> {
    return prisma.actionQueue.findFirst({
        where: {
            organizationId,
            type: WHATSAPP_RETRY_QUEUE_TYPE,
            relatedEntityType: WHATSAPP_RETRY_ENTITY_TYPE,
            relatedEntityId: messageRecordId,
            status: "pending",
        },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            nextRetryAt: true,
        },
    });
}

export async function enqueueWhatsAppRetry(input: {
    organizationId: string;
    messageRecordId: string;
    sourceExternalMessageId: string | null;
    sourceStatus: string | null;
    failureClass: WhatsAppMessageFailureClass | null;
    delaySeconds: number | null;
    reason: string | null;
}): Promise<WhatsAppRetryExecutionResult> {
    const now = new Date();
    const dueAt = input.delaySeconds && input.delaySeconds > 0
        ? new Date(now.getTime() + input.delaySeconds * 1000)
        : now;

    const message = await prisma.whatsAppMessage.findFirst({
        where: {
            id: input.messageRecordId,
            organizationId: input.organizationId,
        },
        select: {
            id: true,
            organizationId: true,
            errorJson: true,
        },
    });

    if (!message) {
        return {
            queueId: null,
            queued: false,
            state: "stale",
            scheduledFor: null,
            reason: "MESSAGE_NOT_FOUND",
        };
    }

    const existing = await findPendingRetryQueueItem(input.organizationId, input.messageRecordId);
    if (existing) {
        const nextErrorJson = updateMessageMetadataEnvelope(message.errorJson, (envelope) => {
            envelope.ledger.retry.pendingQueueId = existing.id;
            envelope.ledger.retry.lastDecision = {
                eligible: true,
                delaySeconds: input.delaySeconds,
                reason: input.reason,
            };
            upsertRetryJobRecord(envelope.ledger, {
                queueId: existing.id,
                sourceExternalMessageId: input.sourceExternalMessageId,
                scheduledAt: now,
                dueAt: existing.nextRetryAt,
                outcome: "duplicate_pending",
                reason: input.reason,
                attemptCount: 0,
            });
            appendLedgerEvent(envelope.ledger, {
                at: now,
                source: "retry_scheduler",
                externalMessageId: input.sourceExternalMessageId,
                lifecycleStatus: input.sourceStatus ?? "failed",
                providerStatus: input.sourceStatus,
                failureClass: input.failureClass,
                queueId: existing.id,
                note: "duplicate_pending_retry_queue",
            });
            return envelope;
        });

        await prisma.whatsAppMessage.update({
            where: { id: message.id },
            data: {
                errorJson: nextErrorJson,
            },
        });

        return {
            queueId: existing.id,
            queued: false,
            state: "duplicate_pending",
            scheduledFor: existing.nextRetryAt?.toISOString() ?? null,
            reason: "RETRY_ALREADY_PENDING",
        };
    }

    const created = await prisma.actionQueue.create({
        data: {
            organizationId: input.organizationId,
            type: WHATSAPP_RETRY_QUEUE_TYPE,
            payloadJson: JSON.stringify(buildRetryPayload({
                organizationId: input.organizationId,
                messageRecordId: input.messageRecordId,
                sourceExternalMessageId: input.sourceExternalMessageId,
                sourceStatus: input.sourceStatus,
                failureClass: input.failureClass,
                delaySeconds: input.delaySeconds,
                reason: input.reason,
                queuedAt: now,
            })),
            priority: "high",
            status: "pending",
            approvalRequired: false,
            relatedEntityType: WHATSAPP_RETRY_ENTITY_TYPE,
            relatedEntityId: input.messageRecordId,
            reason: input.reason ?? "whatsapp_retry_message",
            nextRetryAt: dueAt,
        },
        select: {
            id: true,
        },
    });

    const nextErrorJson = updateMessageMetadataEnvelope(message.errorJson, (envelope) => {
        envelope.ledger.retry.pendingQueueId = created.id;
        envelope.ledger.retry.lastDecision = {
            eligible: true,
            delaySeconds: input.delaySeconds,
            reason: input.reason,
        };
        envelope.ledger.retry.totalScheduled += 1;
        upsertRetryJobRecord(envelope.ledger, {
            queueId: created.id,
            sourceExternalMessageId: input.sourceExternalMessageId,
            scheduledAt: now,
            dueAt,
            outcome: "scheduled",
            reason: input.reason,
            attemptCount: 0,
        });
        appendLedgerEvent(envelope.ledger, {
            at: now,
            source: "retry_scheduler",
            externalMessageId: input.sourceExternalMessageId,
            lifecycleStatus: input.sourceStatus ?? "failed",
            providerStatus: input.sourceStatus,
            failureClass: input.failureClass,
            queueId: created.id,
            note: "retry_scheduled",
        });
        return envelope;
    });

    await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: {
            errorJson: nextErrorJson,
        },
    });

    await createSystemEvent({
        organizationId: input.organizationId,
        type: "whatsapp_retry_scheduled",
        severity: "warn",
        message: "WhatsApp retry scheduled",
        entityType: "whatsapp_message",
        entityId: input.messageRecordId,
        payloadJson: JSON.stringify({
            queueId: created.id,
            sourceExternalMessageId: input.sourceExternalMessageId,
            delaySeconds: input.delaySeconds,
            reason: input.reason,
            scheduledFor: dueAt.toISOString(),
        }),
        dedupeKey: `whatsapp_retry_scheduled:${created.id}`,
    }).catch((error: unknown) => {
        logger.error("WhatsApp retry schedule event failed", {
            organizationId: input.organizationId,
            messageRecordId: input.messageRecordId,
            queueId: created.id,
            error: error instanceof Error ? error.message : String(error),
        });
    });

    try {
        await triggerRetryWorker(input.organizationId);
    } catch (error) {
        logger.error("WhatsApp retry worker trigger failed", {
            organizationId: input.organizationId,
            messageRecordId: input.messageRecordId,
            queueId: created.id,
            error: error instanceof Error ? error.message : String(error),
        });
    }

    return {
        queueId: created.id,
        queued: true,
        state: "scheduled",
        scheduledFor: dueAt.toISOString(),
        reason: input.reason,
    };
}
