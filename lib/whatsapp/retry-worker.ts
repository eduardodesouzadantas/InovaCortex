import crypto from "crypto";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { createSystemEvent } from "@/lib/system-events";
import { sendWhatsAppTemplateForOrg, sendWhatsAppTextForOrg } from "@/lib/whatsapp/meta-client";

import {
    appendLedgerEvent,
    findRetryJobRecord,
    setCurrentLedgerState,
    updateMessageMetadataEnvelope,
    upsertRetryJobRecord,
} from "./message-ledger";
import {
    classifyRetryExecutionFailure,
    computeRetryDelaySeconds,
    resolveRetryableOutboundDescriptor,
    WHATSAPP_MAX_RETRY_ATTEMPTS,
    WHATSAPP_RETRY_ENTITY_TYPE,
    WHATSAPP_RETRY_QUEUE_TYPE,
} from "./retry-service";

import type { WhatsAppRetryQueuePayload } from "./pipeline-contract";

type RetryQueueRecord = {
    id: string;
    organizationId: string;
    payloadJson: string;
    attempts: number;
};

type JsonRecord = Record<string, unknown>;

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

function parseRetryPayload(payloadJson: string): WhatsAppRetryQueuePayload {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (!isRecord(parsed)) {
        throw new Error("INVALID_RETRY_QUEUE_PAYLOAD");
    }

    const jobType = normalizeString(parsed.jobType);
    const organizationId = normalizeString(parsed.organizationId);
    const messageRecordId = normalizeString(parsed.messageRecordId);
    const queuedAt = normalizeString(parsed.queuedAt);
    if (jobType !== WHATSAPP_RETRY_QUEUE_TYPE || !organizationId || !messageRecordId || !queuedAt) {
        throw new Error("INVALID_RETRY_QUEUE_PAYLOAD");
    }

    return {
        jobType,
        organizationId,
        messageRecordId,
        sourceExternalMessageId: normalizeString(parsed.sourceExternalMessageId),
        sourceStatus: normalizeString(parsed.sourceStatus),
        failureClass: normalizeString(parsed.failureClass) as WhatsAppRetryQueuePayload["failureClass"],
        queuedAt,
        delaySeconds: typeof parsed.delaySeconds === "number" && Number.isFinite(parsed.delaySeconds) ? parsed.delaySeconds : null,
        reason: normalizeString(parsed.reason),
    };
}

async function claimDueRetryItems(limit: number, organizationId?: string): Promise<RetryQueueRecord[]> {
    const runId = crypto.randomUUID();
    const now = new Date();
    const lockExpiration = new Date(now.getTime() + 10 * 60 * 1000);

    const candidates = await prisma.actionQueue.findMany({
        where: {
            type: WHATSAPP_RETRY_QUEUE_TYPE,
            status: "pending",
            ...(organizationId ? { organizationId } : {}),
            OR: [
                { nextRetryAt: null },
                { nextRetryAt: { lte: now } },
            ],
            AND: [
                {
                    OR: [
                        { lockedUntil: null },
                        { lockedUntil: { lt: now } },
                    ],
                },
            ],
        },
        orderBy: [
            { nextRetryAt: "asc" },
            { createdAt: "asc" },
        ],
        take: limit,
        select: {
            id: true,
        },
    });

    if (candidates.length === 0) {
        return [];
    }

    const candidateIds = candidates.map((candidate) => candidate.id);
    await prisma.actionQueue.updateMany({
        where: {
            id: { in: candidateIds },
            type: WHATSAPP_RETRY_QUEUE_TYPE,
            status: "pending",
            ...(organizationId ? { organizationId } : {}),
            OR: [
                { nextRetryAt: null },
                { nextRetryAt: { lte: now } },
            ],
            AND: [
                {
                    OR: [
                        { lockedUntil: null },
                        { lockedUntil: { lt: now } },
                    ],
                },
            ],
        },
        data: {
            lockedByRunId: runId,
            lockedUntil: lockExpiration,
            attempts: { increment: 1 },
        },
    });

    return prisma.actionQueue.findMany({
        where: {
            lockedByRunId: runId,
            type: WHATSAPP_RETRY_QUEUE_TYPE,
            status: "pending",
            ...(organizationId ? { organizationId } : {}),
        },
        select: {
            id: true,
            organizationId: true,
            payloadJson: true,
            attempts: true,
        },
    }) as Promise<RetryQueueRecord[]>;
}

async function markQueueExecuted(id: string, reason: string): Promise<void> {
    await prisma.actionQueue.update({
        where: { id },
        data: {
            status: "executed",
            reason,
            executedAt: new Date(),
            lockedByRunId: null,
            lockedUntil: null,
        },
    });
}

async function markQueueRejected(id: string, reason: string): Promise<void> {
    await prisma.actionQueue.update({
        where: { id },
        data: {
            status: "rejected",
            reason,
            lockedByRunId: null,
            lockedUntil: null,
        },
    });
}

async function requeueRetryItem(id: string, reason: string, delaySeconds: number): Promise<Date> {
    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);
    await prisma.actionQueue.update({
        where: { id },
        data: {
            status: "pending",
            reason,
            nextRetryAt,
            lockedByRunId: null,
            lockedUntil: null,
        },
    });
    return nextRetryAt;
}

async function processRetryQueueItem(item: RetryQueueRecord): Promise<void> {
    const now = new Date();
    const payload = parseRetryPayload(item.payloadJson);
    const message = await prisma.whatsAppMessage.findFirst({
        where: {
            id: payload.messageRecordId,
            organizationId: item.organizationId,
        },
        select: {
            id: true,
            organizationId: true,
            messageId: true,
            type: true,
            text: true,
            errorJson: true,
            contact: {
                select: {
                    id: true,
                    phoneNumberE164: true,
                },
            },
        },
    });

    if (!message || payload.organizationId !== item.organizationId) {
        await markQueueRejected(item.id, "RETRY_MESSAGE_NOT_FOUND");
        return;
    }

    const nextDescriptor = resolveRetryableOutboundDescriptor({
        type: message.type,
        text: message.text,
        errorJson: message.errorJson,
    });

    if (!nextDescriptor) {
        const nextErrorJson = updateMessageMetadataEnvelope(message.errorJson, (envelope) => {
            envelope.ledger.retry.pendingQueueId = null;
            envelope.ledger.retry.totalExecuted += 1;
            envelope.ledger.retry.totalFailed += 1;
            upsertRetryJobRecord(envelope.ledger, {
                queueId: item.id,
                sourceExternalMessageId: payload.sourceExternalMessageId,
                scheduledAt: new Date(payload.queuedAt),
                startedAt: now,
                completedAt: now,
                outcome: "terminal_failure",
                reason: "MISSING_RETRYABLE_OUTBOUND_DESCRIPTOR",
                attemptCount: item.attempts,
            });
            appendLedgerEvent(envelope.ledger, {
                at: now,
                source: "retry_worker",
                externalMessageId: payload.sourceExternalMessageId,
                lifecycleStatus: "failed",
                providerStatus: "failed",
                failureClass: "terminal",
                queueId: item.id,
                note: "missing_retryable_outbound_descriptor",
            });
            setCurrentLedgerState(envelope.ledger, {
                lifecycleStatus: "failed",
                failureClass: "terminal",
                externalMessageId: message.messageId,
                eventAt: now,
            });
            return envelope;
        });

        await prisma.whatsAppMessage.update({
            where: { id: message.id },
            data: {
                errorJson: nextErrorJson,
                failedAt: now,
            },
        });
        await markQueueRejected(item.id, "MISSING_RETRYABLE_OUTBOUND_DESCRIPTOR");
        return;
    }

    const existingJob = updateMessageMetadataEnvelope(message.errorJson, (envelope) => {
        const currentJob = findRetryJobRecord(envelope.ledger, item.id);
        if (currentJob?.outcome === "sent" || currentJob?.outcome === "terminal_failure" || currentJob?.outcome === "stale") {
            return envelope;
        }

        upsertRetryJobRecord(envelope.ledger, {
            queueId: item.id,
            sourceExternalMessageId: payload.sourceExternalMessageId,
            scheduledAt: new Date(payload.queuedAt),
            startedAt: now,
            outcome: "scheduled",
            reason: payload.reason,
            attemptCount: item.attempts,
        });
        return envelope;
    });

    if (existingJob !== message.errorJson) {
        await prisma.whatsAppMessage.update({
            where: { id: message.id },
            data: {
                errorJson: existingJob,
            },
        });
    }

    const currentExternalMessageId = message.messageId;
    if (
        payload.sourceExternalMessageId
        && currentExternalMessageId
        && payload.sourceExternalMessageId !== currentExternalMessageId
    ) {
        const nextErrorJson = updateMessageMetadataEnvelope(message.errorJson, (envelope) => {
            envelope.ledger.retry.pendingQueueId = null;
            envelope.ledger.retry.totalExecuted += 1;
            upsertRetryJobRecord(envelope.ledger, {
                queueId: item.id,
                sourceExternalMessageId: payload.sourceExternalMessageId,
                targetExternalMessageId: currentExternalMessageId,
                scheduledAt: new Date(payload.queuedAt),
                startedAt: now,
                completedAt: now,
                outcome: "stale",
                reason: "SUPERSEDED_BY_NEWER_PROVIDER_MESSAGE",
                attemptCount: item.attempts,
            });
            appendLedgerEvent(envelope.ledger, {
                at: now,
                source: "retry_worker",
                externalMessageId: payload.sourceExternalMessageId,
                lifecycleStatus: envelope.ledger.currentStatus ?? "sent",
                providerStatus: envelope.ledger.currentStatus,
                queueId: item.id,
                note: "retry_queue_item_stale",
            });
            return envelope;
        });

        await prisma.whatsAppMessage.update({
            where: { id: message.id },
            data: {
                errorJson: nextErrorJson,
            },
        });
        await markQueueExecuted(item.id, "SUPERSEDED_BY_NEWER_PROVIDER_MESSAGE");
        return;
    }

    const providerResult = nextDescriptor.type === "text"
        ? await sendWhatsAppTextForOrg(item.organizationId, message.contact.phoneNumberE164, nextDescriptor.text)
        : await sendWhatsAppTemplateForOrg(
            item.organizationId,
            message.contact.phoneNumberE164,
            nextDescriptor.templateName,
            nextDescriptor.templateLanguage,
            [],
        );

    if (providerResult.messageId) {
        const nextErrorJson = updateMessageMetadataEnvelope(message.errorJson, (envelope) => {
            envelope.ledger.retry.pendingQueueId = null;
            envelope.ledger.retry.totalExecuted += 1;
            envelope.ledger.retry.totalSucceeded += 1;
            envelope.ledger.retry.lastDecision = null;
            upsertRetryJobRecord(envelope.ledger, {
                queueId: item.id,
                sourceExternalMessageId: payload.sourceExternalMessageId,
                targetExternalMessageId: providerResult.messageId,
                scheduledAt: new Date(payload.queuedAt),
                startedAt: now,
                completedAt: now,
                outcome: "sent",
                reason: "RETRY_SENT",
                attemptCount: item.attempts,
            });
            appendLedgerEvent(envelope.ledger, {
                at: now,
                source: "retry_worker",
                externalMessageId: providerResult.messageId,
                lifecycleStatus: "sent",
                providerStatus: "sent",
                queueId: item.id,
                note: "retry_sent",
            });
            setCurrentLedgerState(envelope.ledger, {
                lifecycleStatus: "sent",
                failureClass: null,
                externalMessageId: providerResult.messageId,
                eventAt: now,
            });
            return envelope;
        });

        await prisma.whatsAppMessage.update({
            where: { id: message.id },
            data: {
                messageId: providerResult.messageId,
                status: "sent",
                sentAt: now,
                deliveredAt: null,
                readAt: null,
                failedAt: null,
                metaStatusPayload: JSON.stringify({
                    source: "retry_worker",
                    queueId: item.id,
                    previousExternalMessageId: payload.sourceExternalMessageId,
                    currentExternalMessageId: providerResult.messageId,
                    retriedAt: now.toISOString(),
                }),
                errorJson: nextErrorJson,
            },
        });

        await createSystemEvent({
            organizationId: item.organizationId,
            type: "whatsapp_retry_sent",
            severity: "info",
            message: "WhatsApp retry sent",
            entityType: WHATSAPP_RETRY_ENTITY_TYPE,
            entityId: message.id,
            payloadJson: JSON.stringify({
                queueId: item.id,
                sourceExternalMessageId: payload.sourceExternalMessageId,
                currentExternalMessageId: providerResult.messageId,
                attempts: item.attempts,
            }),
            dedupeKey: `whatsapp_retry_sent:${item.id}`,
        }).catch((error: unknown) => {
            logger.error("WhatsApp retry sent event failed", {
                organizationId: item.organizationId,
                messageRecordId: message.id,
                queueId: item.id,
                error: error instanceof Error ? error.message : String(error),
            });
        });

        await markQueueExecuted(item.id, "RETRY_SENT");
        return;
    }

    const failure = classifyRetryExecutionFailure(providerResult.error);
    const canRetryAgain = failure.failureClass === "retryable" && item.attempts < WHATSAPP_MAX_RETRY_ATTEMPTS;
    const nextDelaySeconds = canRetryAgain ? computeRetryDelaySeconds(item.attempts + 1) : null;
    const nextRetryAt = canRetryAgain && nextDelaySeconds ? new Date(now.getTime() + nextDelaySeconds * 1000) : null;
    const nextErrorJson = updateMessageMetadataEnvelope(message.errorJson, (envelope) => {
        envelope.ledger.retry.pendingQueueId = canRetryAgain ? item.id : null;
        envelope.ledger.retry.lastDecision = canRetryAgain
            ? {
                eligible: true,
                delaySeconds: nextDelaySeconds,
                reason: "RETRY_EXECUTION_TRANSIENT_FAILURE",
            }
            : {
                eligible: false,
                delaySeconds: null,
                reason: failure.failureClass === "terminal"
                    ? "RETRY_EXECUTION_TERMINAL_FAILURE"
                    : "RETRY_EXHAUSTED",
            };
        envelope.ledger.retry.totalExecuted += 1;
        envelope.ledger.retry.totalFailed += 1;
        upsertRetryJobRecord(envelope.ledger, {
            queueId: item.id,
            sourceExternalMessageId: payload.sourceExternalMessageId,
            scheduledAt: new Date(payload.queuedAt),
            dueAt: nextRetryAt,
            startedAt: now,
            completedAt: canRetryAgain ? null : now,
            outcome: canRetryAgain ? "retryable_failure" : "terminal_failure",
            reason: providerResult.error ?? failure.code,
            attemptCount: item.attempts,
        });
        appendLedgerEvent(envelope.ledger, {
            at: now,
            source: "retry_worker",
            externalMessageId: payload.sourceExternalMessageId ?? message.messageId,
            lifecycleStatus: "failed",
            providerStatus: "failed",
            failureClass: failure.failureClass,
            queueId: item.id,
            note: canRetryAgain ? "retry_requeued" : "retry_failed_terminal",
        });
        setCurrentLedgerState(envelope.ledger, {
            lifecycleStatus: "failed",
            failureClass: failure.failureClass,
            externalMessageId: message.messageId,
            eventAt: now,
        });
        return envelope;
    });

    await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: {
            status: "failed",
            failedAt: now,
            metaStatusPayload: JSON.stringify({
                source: "retry_worker",
                queueId: item.id,
                providerError: providerResult.error ?? null,
                attempts: item.attempts,
                nextRetryAt: nextRetryAt?.toISOString() ?? null,
            }),
            errorJson: nextErrorJson,
        },
    });

    if (canRetryAgain && nextDelaySeconds) {
        await requeueRetryItem(item.id, providerResult.error ?? "RETRY_EXECUTION_TRANSIENT_FAILURE", nextDelaySeconds);
        await createSystemEvent({
            organizationId: item.organizationId,
            type: "whatsapp_retry_requeued",
            severity: "warn",
            message: "WhatsApp retry requeued",
            entityType: WHATSAPP_RETRY_ENTITY_TYPE,
            entityId: message.id,
            payloadJson: JSON.stringify({
                queueId: item.id,
                attempts: item.attempts,
                nextRetryAt: nextRetryAt?.toISOString() ?? null,
                providerError: providerResult.error ?? null,
            }),
            dedupeKey: `whatsapp_retry_requeued:${item.id}:${item.attempts}`,
        }).catch((error: unknown) => {
            logger.error("WhatsApp retry requeue event failed", {
                organizationId: item.organizationId,
                messageRecordId: message.id,
                queueId: item.id,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        return;
    }

    await createSystemEvent({
        organizationId: item.organizationId,
        type: "whatsapp_retry_failed",
        severity: failure.failureClass === "terminal" ? "error" : "warn",
        message: "WhatsApp retry failed",
        entityType: WHATSAPP_RETRY_ENTITY_TYPE,
        entityId: message.id,
        payloadJson: JSON.stringify({
            queueId: item.id,
            attempts: item.attempts,
            providerError: providerResult.error ?? null,
            failureClass: failure.failureClass,
        }),
        dedupeKey: `whatsapp_retry_failed:${item.id}:${item.attempts}`,
    }).catch((error: unknown) => {
        logger.error("WhatsApp retry failure event failed", {
            organizationId: item.organizationId,
            messageRecordId: message.id,
            queueId: item.id,
            error: error instanceof Error ? error.message : String(error),
        });
    });

    await markQueueRejected(item.id, providerResult.error ?? "RETRY_EXECUTION_FAILED");
}

export async function runDueWhatsAppRetryDispatch(options: {
    organizationId?: string;
    maxJobs?: number;
} = {}): Promise<number> {
    const limit = options.maxJobs ?? 10;
    const lockedItems = await claimDueRetryItems(limit, options.organizationId);

    for (const item of lockedItems) {
        try {
            await processRetryQueueItem(item);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error("WhatsApp retry queue item failed", {
                queueId: item.id,
                organizationId: item.organizationId,
                error: message,
            });
            await markQueueRejected(item.id, message);
        }
    }

    return lockedItems.length;
}
