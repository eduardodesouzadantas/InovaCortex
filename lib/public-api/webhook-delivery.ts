import { randomUUID } from "crypto";

import { logger } from "@/lib/logger";
import { prisma as defaultDb } from "@/lib/prisma";
import { decrypt } from "@/lib/security/crypto";

import { buildWebhookEventEnvelope, type WebhookEventEnvelope, type WebhookEventType } from "./webhook-events";
import {
    generateWebhookSecret,
    isTransientWebhookDeliveryFailure,
    sanitizeWebhookFailureMessage,
    signWebhookPayload,
} from "./webhook-signature";

const DELIVERY_MAX_ATTEMPTS = 2;
const DELIVERY_TIMEOUT_MS = 10_000;

type WebhookEndpointForDelivery = {
    id: string;
    organizationId: string;
    url: string;
    secretEncrypted: string;
    isActive: boolean;
    subscribedEvents: string[];
    lastDeliveryAt: Date | null;
    lastDeliveryStatus: string | null;
    lastDeliveryError: string | null;
    deliveryAttemptCount: number;
};

type WebhookDeliveryDb = typeof defaultDb & {
    webhookEndpoint?: {
        findMany: (args: {
            where: {
                organizationId: string;
                isActive?: boolean;
                subscribedEvents?: { has: WebhookEventType };
            };
            select: {
                id: true;
                organizationId: true;
                url: true;
                secretEncrypted: true;
                isActive: true;
                subscribedEvents: true;
                lastDeliveryAt: true;
                lastDeliveryStatus: true;
                lastDeliveryError: true;
                deliveryAttemptCount: true;
            };
        }) => Promise<WebhookEndpointForDelivery[]>;
        update: (args: {
            where: { id: string };
            data: {
                lastDeliveryAt?: Date | null;
                lastDeliveryStatus?: string | null;
                lastDeliveryError?: string | null;
                deliveryAttemptCount?: { increment: number } | number;
            };
        }) => Promise<unknown>;
    };
    webhookDelivery?: {
        upsert: (args: {
            where: {
                webhookEndpointId_eventId: {
                    webhookEndpointId: string;
                    eventId: string;
                };
            };
            create: {
                organizationId: string;
                webhookEndpointId: string;
                eventId: string;
                eventType: string;
                payloadJson: string;
                attemptCount: number;
                status: string;
            };
            update: {
                eventType?: string;
                payloadJson?: string;
                status?: string;
            };
        }) => Promise<{ id: string }>;
        update: (args: {
            where: {
                webhookEndpointId_eventId: {
                    webhookEndpointId: string;
                    eventId: string;
                };
            };
            data: {
                attemptCount?: { increment: number } | number;
                status?: string;
                responseCode?: number | null;
                errorSummary?: string | null;
                lastAttemptAt?: Date | null;
                deliveredAt?: Date | null;
            };
        }) => Promise<unknown>;
    };
};

type WebhookDeliveryOutcome = {
    endpointId: string;
    eventId: string;
    eventType: WebhookEventType;
    delivered: boolean;
    attempts: number;
    responseCode: number | null;
    errorSummary: string | null;
};

function getWebhookDb(db?: Partial<WebhookDeliveryDb>): WebhookDeliveryDb {
    return (db ?? (defaultDb as unknown as WebhookDeliveryDb)) as WebhookDeliveryDb;
}

function buildWebhookHeaders(input: {
    endpointId: string;
    eventType: WebhookEventType;
    timestamp: string;
    signature: string;
    eventId: string;
}): Headers {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("X-InovaCortex-Event", input.eventType);
    headers.set("X-InovaCortex-Event-Id", input.eventId);
    headers.set("X-InovaCortex-Webhook-Id", input.endpointId);
    headers.set("X-InovaCortex-Timestamp", input.timestamp);
    headers.set("X-InovaCortex-Signature", input.signature);
    headers.set("User-Agent", "InovaCortex-Webhook/1.0");
    return headers;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DELIVERY_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
}

async function persistDeliveryAttempt(db: WebhookDeliveryDb, input: {
    endpointId: string;
    eventId: string;
    eventType: WebhookEventType;
    payloadJson: string;
    responseCode: number | null;
    errorSummary: string | null;
    delivered: boolean;
    attemptCount: number;
}) {
    const status = input.delivered ? "delivered" : "failed";
    const deliveryUpdate = db.webhookDelivery?.update({
        where: {
            webhookEndpointId_eventId: {
                webhookEndpointId: input.endpointId,
                eventId: input.eventId,
            },
        },
        data: {
            attemptCount: input.attemptCount,
            status,
            responseCode: input.responseCode,
            errorSummary: input.errorSummary,
            lastAttemptAt: new Date(),
            deliveredAt: input.delivered ? new Date() : null,
        },
    });

    if (deliveryUpdate) {
        await deliveryUpdate.catch((error: unknown) => {
            logger.warn("Failed to persist webhook delivery attempt", {
                endpointId: input.endpointId,
                eventId: input.eventId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }

    const endpointUpdate = db.webhookEndpoint?.update({
        where: { id: input.endpointId },
        data: {
            lastDeliveryAt: new Date(),
            lastDeliveryStatus: status,
            lastDeliveryError: input.delivered ? null : input.errorSummary,
            deliveryAttemptCount: { increment: input.attemptCount },
        },
    });

    if (endpointUpdate) {
        await endpointUpdate.catch((error: unknown) => {
            logger.warn("Failed to persist webhook endpoint delivery state", {
                endpointId: input.endpointId,
                eventId: input.eventId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }
}

async function deliverToEndpoint(db: WebhookDeliveryDb, endpoint: WebhookEndpointForDelivery, event: WebhookEventEnvelope): Promise<WebhookDeliveryOutcome> {
    const secret = (() => {
        try {
            return decrypt(endpoint.secretEncrypted);
        } catch {
            return null;
        }
    })();

    const payloadJson = JSON.stringify(event);

    if (!secret) {
        const errorSummary = "WEBHOOK_SECRET_UNAVAILABLE";
        const deliveryUpsert = db.webhookDelivery?.upsert({
            where: {
                webhookEndpointId_eventId: {
                    webhookEndpointId: endpoint.id,
                    eventId: event.id,
                },
            },
            create: {
                organizationId: endpoint.organizationId,
                webhookEndpointId: endpoint.id,
                eventId: event.id,
                eventType: event.type,
                payloadJson,
                attemptCount: 0,
                status: "failed",
            },
            update: {
                eventType: event.type,
                payloadJson,
                status: "failed",
            },
        });

        if (deliveryUpsert) {
            await deliveryUpsert.catch(() => null);
        }

        await persistDeliveryAttempt(db, {
            endpointId: endpoint.id,
            eventId: event.id,
            eventType: event.type,
            payloadJson,
            responseCode: null,
            errorSummary,
            delivered: false,
            attemptCount: 0,
        });

        return {
            endpointId: endpoint.id,
            eventId: event.id,
            eventType: event.type,
            delivered: false,
            attempts: 0,
            responseCode: null,
            errorSummary,
        };
    }

    const deliveryUpsert = db.webhookDelivery?.upsert({
        where: {
            webhookEndpointId_eventId: {
                webhookEndpointId: endpoint.id,
                eventId: event.id,
            },
        },
        create: {
            organizationId: endpoint.organizationId,
            webhookEndpointId: endpoint.id,
            eventId: event.id,
            eventType: event.type,
            payloadJson,
            attemptCount: 0,
            status: "pending",
        },
        update: {
            eventType: event.type,
            payloadJson,
            status: "pending",
        },
    });

    if (deliveryUpsert) {
        await deliveryUpsert;
    }

    let attempts = 0;
    let responseCode: number | null = null;
    let errorSummary: string | null = null;

    for (let attempt = 1; attempt <= DELIVERY_MAX_ATTEMPTS; attempt += 1) {
        attempts = attempt;
        const attemptUpdate = db.webhookDelivery?.update({
            where: {
                webhookEndpointId_eventId: {
                    webhookEndpointId: endpoint.id,
                    eventId: event.id,
                },
            },
            data: {
                attemptCount: { increment: 1 },
                lastAttemptAt: new Date(),
            },
        });

        if (attemptUpdate) {
            await attemptUpdate.catch((error: unknown) => {
                logger.warn("Failed to increment webhook delivery attempt", {
                    endpointId: endpoint.id,
                    eventId: event.id,
                    error: error instanceof Error ? error.message : String(error),
                });
            });
        }

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = signWebhookPayload(secret, timestamp, payloadJson);
        const headers = buildWebhookHeaders({
            endpointId: endpoint.id,
            eventType: event.type,
            timestamp,
            signature,
            eventId: event.id,
        });

        try {
            const response = await fetchWithTimeout(endpoint.url, {
                method: "POST",
                headers,
                body: payloadJson,
            });

            responseCode = response.status;
            if (response.ok) {
                await persistDeliveryAttempt(db, {
                    endpointId: endpoint.id,
                    eventId: event.id,
                    eventType: event.type,
                    payloadJson,
                    responseCode,
                    errorSummary: null,
                    delivered: true,
                    attemptCount: attempt,
                });
                return {
                    endpointId: endpoint.id,
                    eventId: event.id,
                    eventType: event.type,
                    delivered: true,
                    attempts,
                    responseCode,
                    errorSummary: null,
                };
            }

            const responseText = await response.text().catch(() => "");
            errorSummary = sanitizeWebhookFailureMessage(responseText || `HTTP ${response.status}`);
            if (!isTransientWebhookDeliveryFailure(response.status) || attempt === DELIVERY_MAX_ATTEMPTS) {
                break;
            }
        } catch (error) {
            errorSummary = sanitizeWebhookFailureMessage(error);
            if (attempt === DELIVERY_MAX_ATTEMPTS) {
                break;
            }
        }
    }

    await persistDeliveryAttempt(db, {
        endpointId: endpoint.id,
        eventId: event.id,
        eventType: event.type,
        payloadJson,
        responseCode,
        errorSummary,
        delivered: false,
        attemptCount: attempts,
    });

    return {
        endpointId: endpoint.id,
        eventId: event.id,
        eventType: event.type,
        delivered: false,
        attempts,
        responseCode,
        errorSummary,
    };
}

export async function dispatchWebhookEvent<TData extends Record<string, unknown>>(input: {
    organizationId: string;
    eventType: WebhookEventType;
    data: TData;
    eventId?: string;
    createdAt?: Date;
    db?: Partial<WebhookDeliveryDb>;
}): Promise<{
    event: WebhookEventEnvelope<TData>;
    attempted: number;
    delivered: number;
    failed: number;
    skipped: boolean;
}> {
    const db = getWebhookDb(input.db);

    if (process.env.NODE_ENV === "test" && !input.db) {
        return {
            event: buildWebhookEventEnvelope({
                eventId: input.eventId ?? `evt_${randomUUID()}`,
                eventType: input.eventType,
                organizationId: input.organizationId,
                data: input.data,
                createdAt: input.createdAt,
            }),
            attempted: 0,
            delivered: 0,
            failed: 0,
            skipped: true,
        };
    }

    if (!db.webhookEndpoint?.findMany || !db.webhookDelivery?.upsert || !db.webhookDelivery?.update || !db.webhookEndpoint?.update) {
        return {
            event: buildWebhookEventEnvelope({
                eventId: input.eventId ?? `evt_${randomUUID()}`,
                eventType: input.eventType,
                organizationId: input.organizationId,
                data: input.data,
                createdAt: input.createdAt,
            }),
            attempted: 0,
            delivered: 0,
            failed: 0,
            skipped: true,
        };
    }

    const event = buildWebhookEventEnvelope({
        eventId: input.eventId ?? `evt_${randomUUID()}`,
        eventType: input.eventType,
        organizationId: input.organizationId,
        data: input.data,
        createdAt: input.createdAt,
    });

    const endpoints = await db.webhookEndpoint.findMany({
        where: {
            organizationId: input.organizationId,
            isActive: true,
            subscribedEvents: {
                has: input.eventType,
            },
        },
        select: {
            id: true,
            organizationId: true,
            url: true,
            secretEncrypted: true,
            isActive: true,
            subscribedEvents: true,
            lastDeliveryAt: true,
            lastDeliveryStatus: true,
            lastDeliveryError: true,
            deliveryAttemptCount: true,
        },
    });

    if (endpoints.length === 0) {
        return {
            event,
            attempted: 0,
            delivered: 0,
            failed: 0,
            skipped: false,
        };
    }

    const results = await Promise.allSettled(endpoints.map((endpoint) => deliverToEndpoint(db, endpoint, event)));
    let delivered = 0;
    let failed = 0;

    for (const result of results) {
        if (result.status === "fulfilled") {
            if (result.value.delivered) {
                delivered += 1;
            } else {
                failed += 1;
            }
        } else {
            failed += 1;
            logger.warn("Webhook delivery task rejected", {
                organizationId: input.organizationId,
                eventType: input.eventType,
                error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            });
        }
    }

    logger.info("webhook_event_dispatched", {
        organizationId: input.organizationId,
        eventId: event.id,
        eventType: event.type,
        attempted: endpoints.length,
        delivered,
        failed,
    });

    return {
        event,
        attempted: endpoints.length,
        delivered,
        failed,
        skipped: false,
    };
}

export function generateWebhookEndpointSecret(): string {
    return generateWebhookSecret();
}
