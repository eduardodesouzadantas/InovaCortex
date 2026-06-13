import { handleInboundWhatsAppMessage, normalizeMetaWebhookMessages } from "@/lib/whatsapp/inbound-handler";

import { reconcileMetaMessageStatusEvent } from "./message-status-service";

import type { InboundWhatsAppPipelineResult, WhatsAppMessageStatusReconciliationResult } from "./pipeline-contract";

type InboundMetaWebhookBody = Parameters<typeof normalizeMetaWebhookMessages>[0];

export type MetaWebhookBody = {
    object?: string;
    entry?: Array<{
        changes?: Array<{
            field?: string;
            value?: {
                metadata?: { phone_number_id?: string };
                statuses?: unknown[];
                messages?: unknown[];
            };
        }>;
    }>;
};

export type MetaWebhookProcessingResult = {
    statusResults: WhatsAppMessageStatusReconciliationResult[];
    inboundResults: InboundWhatsAppPipelineResult[];
};

export function extractMetaStatusEvents(body: MetaWebhookBody): unknown[] {
    const events: unknown[] = [];

    for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
            for (const status of change.value?.statuses ?? []) {
                events.push(status);
            }
        }
    }

    return events;
}

export async function processMetaWebhookBody(body: MetaWebhookBody): Promise<MetaWebhookProcessingResult> {
    const statusResults: WhatsAppMessageStatusReconciliationResult[] = [];
    for (const statusEvent of extractMetaStatusEvents(body)) {
        statusResults.push(await reconcileMetaMessageStatusEvent(statusEvent));
    }

    const inboundResults: InboundWhatsAppPipelineResult[] = [];
    for (const inboundMessage of normalizeMetaWebhookMessages(body as InboundMetaWebhookBody)) {
        inboundResults.push(await handleInboundWhatsAppMessage(inboundMessage, {
            dispatchCopilot: true,
        }));
    }

    return {
        statusResults,
        inboundResults,
    };
}
