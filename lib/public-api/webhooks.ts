import { encrypt } from "@/lib/security/crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { setRequestContext } from "@/lib/observability/request-context";

import { dispatchWebhookEvent, generateWebhookEndpointSecret } from "./webhook-delivery";
import { SUPPORTED_WEBHOOK_EVENTS, isSupportedWebhookEventType, normalizeWebhookEventTypes, type WebhookEventType } from "./webhook-events";

export type WebhookEndpointView = {
    id: string;
    url: string;
    isActive: boolean;
    subscribedEvents: WebhookEventType[];
    lastDeliveryAt: string | null;
    lastDeliveryStatus: string | null;
    lastDeliveryError: string | null;
    deliveryAttemptCount: number;
    createdAt: string;
    updatedAt: string;
    secretConfigured: boolean;
};

export type WebhookEndpointCreateInput = {
    organizationId: string;
    url: string;
    subscribedEvents: WebhookEventType[];
    isActive?: boolean;
};

export type WebhookEndpointUpdateInput = {
    organizationId: string;
    endpointId: string;
    url?: string;
    subscribedEvents?: WebhookEventType[];
    isActive?: boolean;
    rotateSecret?: boolean;
};

export type WebhookEndpointCreateResult = {
    webhook: WebhookEndpointView;
    secret: string;
};

export type WebhookEndpointUpdateResult = {
    webhook: WebhookEndpointView;
    secret: string | null;
};

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
}

export function validateWebhookDestinationUrl(rawUrl: string): string {
    const url = rawUrl.trim();
    if (!url) {
        throw new Error("WEBHOOK_URL_REQUIRED");
    }

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error("WEBHOOK_URL_INVALID");
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("WEBHOOK_URL_INVALID");
    }

    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
        throw new Error("WEBHOOK_URL_INSECURE");
    }

    if (parsed.username || parsed.password) {
        throw new Error("WEBHOOK_URL_INVALID");
    }

    return parsed.toString();
}

export function parseWebhookSubscribedEvents(value: unknown): WebhookEventType[] {
    const events = normalizeWebhookEventTypes(value);
    if (events.length === 0) {
        throw new Error("WEBHOOK_EVENTS_REQUIRED");
    }
    return events;
}

function toWebhookEndpointView(record: {
    id: string;
    url: string;
    isActive: boolean;
    subscribedEvents: string[];
    lastDeliveryAt: Date | null;
    lastDeliveryStatus: string | null;
    lastDeliveryError: string | null;
    deliveryAttemptCount: number;
    createdAt: Date;
    updatedAt: Date;
    secretEncrypted: string;
}): WebhookEndpointView {
    return {
        id: record.id,
        url: record.url,
        isActive: record.isActive,
        subscribedEvents: record.subscribedEvents.filter(isSupportedWebhookEventType),
        lastDeliveryAt: toIso(record.lastDeliveryAt),
        lastDeliveryStatus: record.lastDeliveryStatus,
        lastDeliveryError: record.lastDeliveryError,
        deliveryAttemptCount: record.deliveryAttemptCount,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        secretConfigured: Boolean(record.secretEncrypted),
    };
}

export async function listWebhookEndpoints(organizationId: string): Promise<{
    webhooks: WebhookEndpointView[];
    supportedEvents: WebhookEventType[];
}> {
    const records = await (prisma as any).webhookEndpoint.findMany({
        where: { organizationId },
        orderBy: [{ createdAt: "desc" }],
        select: {
            id: true,
            url: true,
            isActive: true,
            subscribedEvents: true,
            lastDeliveryAt: true,
            lastDeliveryStatus: true,
            lastDeliveryError: true,
            deliveryAttemptCount: true,
            createdAt: true,
            updatedAt: true,
            secretEncrypted: true,
        },
    });

    return {
        webhooks: records.map(toWebhookEndpointView),
        supportedEvents: [...SUPPORTED_WEBHOOK_EVENTS],
    };
}

export async function createWebhookEndpoint(input: WebhookEndpointCreateInput): Promise<WebhookEndpointCreateResult> {
    const secret = generateWebhookEndpointSecret();
    const url = validateWebhookDestinationUrl(input.url);
    const subscribedEvents = parseWebhookSubscribedEvents(input.subscribedEvents);

    setRequestContext({
        organizationId: input.organizationId,
        operation: "webhook_management",
    });

    const endpoint = await (prisma as any).webhookEndpoint.create({
        data: {
            organizationId: input.organizationId,
            url,
            secretEncrypted: encrypt(secret),
            isActive: input.isActive ?? true,
            subscribedEvents,
        },
        select: {
            id: true,
            url: true,
            isActive: true,
            subscribedEvents: true,
            lastDeliveryAt: true,
            lastDeliveryStatus: true,
            lastDeliveryError: true,
            deliveryAttemptCount: true,
            createdAt: true,
            updatedAt: true,
            secretEncrypted: true,
        },
    });

    logger.info("webhook_endpoint_created", {
        organizationId: input.organizationId,
        webhookEndpointId: endpoint.id,
        subscribedEvents,
    });

    return {
        webhook: toWebhookEndpointView(endpoint),
        secret,
    };
}

export async function updateWebhookEndpoint(input: WebhookEndpointUpdateInput): Promise<WebhookEndpointUpdateResult> {
    setRequestContext({
        organizationId: input.organizationId,
        operation: "webhook_management",
    });

    const existing = await (prisma as any).webhookEndpoint.findFirst({
        where: {
            id: input.endpointId,
            organizationId: input.organizationId,
        },
        select: {
            id: true,
            url: true,
            isActive: true,
            subscribedEvents: true,
            lastDeliveryAt: true,
            lastDeliveryStatus: true,
            lastDeliveryError: true,
            deliveryAttemptCount: true,
            createdAt: true,
            updatedAt: true,
            secretEncrypted: true,
        },
    });

    if (!existing) {
        throw new Error("WEBHOOK_ENDPOINT_NOT_FOUND");
    }

    const updateData: {
        url?: string;
        isActive?: boolean;
        subscribedEvents?: WebhookEventType[];
        secretEncrypted?: string;
    } = {};

    if (typeof input.url === "string") {
        updateData.url = validateWebhookDestinationUrl(input.url);
    }

    if (typeof input.isActive === "boolean") {
        updateData.isActive = input.isActive;
    }

    if (typeof input.subscribedEvents !== "undefined") {
        updateData.subscribedEvents = parseWebhookSubscribedEvents(input.subscribedEvents);
    }

    let secret: string | null = null;
    if (input.rotateSecret) {
        secret = generateWebhookEndpointSecret();
        updateData.secretEncrypted = encrypt(secret);
    }

    if (Object.keys(updateData).length === 0) {
        throw new Error("WEBHOOK_NO_CHANGES");
    }

    const updated = await (prisma as any).webhookEndpoint.update({
        where: { id: existing.id },
        data: updateData,
        select: {
            id: true,
            url: true,
            isActive: true,
            subscribedEvents: true,
            lastDeliveryAt: true,
            lastDeliveryStatus: true,
            lastDeliveryError: true,
            deliveryAttemptCount: true,
            createdAt: true,
            updatedAt: true,
            secretEncrypted: true,
        },
    });

    logger.info("webhook_endpoint_updated", {
        organizationId: input.organizationId,
        webhookEndpointId: updated.id,
        rotatedSecret: Boolean(secret),
    });

    return {
        webhook: toWebhookEndpointView(updated),
        secret,
    };
}

export async function deleteWebhookEndpoint(input: {
    organizationId: string;
    endpointId: string;
}): Promise<void> {
    setRequestContext({
        organizationId: input.organizationId,
        operation: "webhook_management",
    });

    const existing = await (prisma as any).webhookEndpoint.findFirst({
        where: {
            id: input.endpointId,
            organizationId: input.organizationId,
        },
        select: {
            id: true,
        },
    });

    if (!existing) {
        throw new Error("WEBHOOK_ENDPOINT_NOT_FOUND");
    }

    await (prisma as any).webhookEndpoint.delete({
        where: {
            id: existing.id,
        },
    });

    logger.info("webhook_endpoint_deleted", {
        organizationId: input.organizationId,
        webhookEndpointId: existing.id,
    });
}

export async function emitWebhookEvent<TData extends Record<string, unknown>>(input: {
    organizationId: string;
    eventType: WebhookEventType;
    data: TData;
    eventId?: string;
    createdAt?: Date;
}): Promise<void> {
    setRequestContext({
        organizationId: input.organizationId,
        operation: "webhook_emit",
    });

    try {
        await dispatchWebhookEvent(input);
    } catch (error) {
        logger.error("webhook_event_dispatch_failed", {
            organizationId: input.organizationId,
            eventType: input.eventType,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
