export const SUPPORTED_WEBHOOK_EVENTS = [
    "contact.created",
    "deal.created",
    "deal.updated",
    "activity.created",
    "message.received",
] as const;

export type WebhookEventType = (typeof SUPPORTED_WEBHOOK_EVENTS)[number];

export type WebhookEventEnvelope<TData extends Record<string, unknown> = Record<string, unknown>> = {
    id: string;
    type: WebhookEventType;
    createdAt: string;
    organizationId: string;
    data: TData;
};

const WEBHOOK_EVENT_SET = new Set<string>(SUPPORTED_WEBHOOK_EVENTS);

export function isSupportedWebhookEventType(value: unknown): value is WebhookEventType {
    return typeof value === "string" && WEBHOOK_EVENT_SET.has(value);
}

export function normalizeWebhookEventTypes(input: unknown): WebhookEventType[] {
    if (!Array.isArray(input)) {
        return [];
    }

    return [...new Set(
        input
            .filter(isSupportedWebhookEventType)
            .map((value) => value.trim() as WebhookEventType),
    )];
}

export function buildWebhookEventEnvelope<TData extends Record<string, unknown>>(input: {
    eventId: string;
    eventType: WebhookEventType;
    organizationId: string;
    data: TData;
    createdAt?: Date;
}): WebhookEventEnvelope<TData> {
    return {
        id: input.eventId,
        type: input.eventType,
        createdAt: (input.createdAt ?? new Date()).toISOString(),
        organizationId: input.organizationId,
        data: input.data,
    };
}

