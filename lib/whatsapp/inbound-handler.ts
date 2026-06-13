import { getAgencyOrgSlug } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { routeWhatsAppMessage } from "@/lib/whatsapp/command-parser";
import {
    getOrCreateWhatsAppCopilotSession,
    mapSenderToTenantActor,
} from "@/lib/whatsapp/context-service";
import {
    handleInboundWhatsAppMessage,
    type InboundMessage,
    type InboundWhatsAppMessageInput,
} from "@/lib/whatsapp/inbound-pipeline";
import { verifyMetaSignature as verifyMetaWebhookSignature } from "@/lib/webhooks/security";

import type { InboundWhatsAppPipelineResult } from "./pipeline-contract";

type MetaWebhookMessage = {
    from?: string;
    id?: string;
    text?: { body?: string };
    timestamp?: string;
    type?: string;
    [key: string]: unknown;
};

type MetaWebhookValue = {
    contacts?: Array<{ profile?: { name?: string } }>;
    messages?: MetaWebhookMessage[];
    metadata?: { phone_number_id?: string };
};

type MetaWebhookBody = {
    entry?: Array<{
        changes?: Array<{
            value?: MetaWebhookValue;
        }>;
    }>;
    object?: string;
};

function isValidInboundMetaMessage(message: MetaWebhookMessage): message is MetaWebhookMessage & {
    from: string;
    id: string;
    timestamp: string;
} {
    return typeof message.from === "string"
        && typeof message.id === "string"
        && typeof message.timestamp === "string";
}

function maskPhone(phone: string): string {
    if (phone.length <= 4) return "****";
    return `${"*".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
}

async function resolveDefaultInboundOrg() {
    const preferredSlug = process.env.WHATSAPP_COPILOT_ORG_SLUG?.trim() || getAgencyOrgSlug();
    return prisma.organization.findUnique({
        where: { slug: preferredSlug },
        select: { id: true, slug: true },
    });
}

export function validateMetaSignature(rawBody: string, signature: string | null): boolean {
    const secret = process.env.META_APP_SECRET;
    if (!secret) {
        logger.error("CRITICAL: META_APP_SECRET not configured. Rejecting webhook to prevent spoofing.");
        return false;
    }
    return verifyMetaWebhookSignature(rawBody, signature, secret);
}

export function parseInboundMessages(body: MetaWebhookBody): InboundMessage[] {
    return normalizeMetaWebhookMessages(body).map((message) => ({
        from: message.fromPhone,
        messageId: message.messageId,
        text: message.messageText,
        timestamp: message.timestamp,
        type: message.type,
        profileName: message.profileName ?? undefined,
        raw: message.raw,
    }));
}

export function normalizeMetaWebhookMessages(body: MetaWebhookBody): InboundWhatsAppMessageInput[] {
    const messages: InboundWhatsAppMessageInput[] = [];

    for (const entry of body?.entry || []) {
        for (const change of entry?.changes || []) {
            const value = change?.value;
            const phoneNumberId = value?.metadata?.phone_number_id;
            const profileName = value?.contacts?.[0]?.profile?.name ?? null;

            for (const msg of value?.messages || []) {
                if (!isValidInboundMetaMessage(msg)) {
                    continue;
                }

                const type = typeof msg.type === "string" ? msg.type : "text";
                const messageText = type === "text" && msg.text?.body
                    ? msg.text.body
                    : `[${type} message]`;

                messages.push({
                    phoneNumberId: typeof phoneNumberId === "string" ? phoneNumberId : null,
                    fromPhone: msg.from,
                    profileName,
                    messageId: msg.id,
                    messageText,
                    timestamp: Number.parseInt(msg.timestamp, 10),
                    type,
                    raw: msg,
                });
            }
        }
    }

    return messages.filter((message) =>
        typeof message.fromPhone === "string"
        && message.fromPhone.length > 0
        && typeof message.messageId === "string"
        && message.messageId.length > 0
        && Number.isFinite(message.timestamp)
        && message.timestamp > 0,
    );
}

export async function mapSenderToOrg(phone: string): Promise<{
    orgId: string;
    orgSlug: string;
    userId: string;
    role: string;
} | null> {
    const actor = await mapSenderToTenantActor(phone);
    if (!actor) {
        return null;
    }

    return actor;
}

export { handleInboundWhatsAppMessage };
export type {
    InboundMessage,
    InboundWhatsAppMessageInput,
    InboundWhatsAppPipelineResult as HandleInboundWhatsAppMessageResult,
};

export async function handleInbound(rawBody: string, signature: string | null) {
    if (!validateMetaSignature(rawBody, signature)) {
        logger.error("WhatsApp Webhook: invalid signature - request rejected");
        return { ok: false, reason: "invalid_signature" as const };
    }

    let body: MetaWebhookBody;
    try {
        body = JSON.parse(rawBody) as MetaWebhookBody;
    } catch {
        return { ok: false, reason: "invalid_json" as const };
    }

    if (body.object !== "whatsapp_business_account") {
        return { ok: true, reason: "not_a_whatsapp_event" as const };
    }

    const messages = normalizeMetaWebhookMessages(body);
    const fallbackOrg = await resolveDefaultInboundOrg();
    let dispatched = 0;

    for (const message of messages) {
        const actorCtx = await mapSenderToTenantActor(message.fromPhone);
        const inboundOrg = actorCtx
            ? { organizationId: actorCtx.orgId, orgSlug: actorCtx.orgSlug }
            : fallbackOrg
                ? { organizationId: fallbackOrg.id, orgSlug: fallbackOrg.slug }
                : null;

        if (!inboundOrg) {
            logger.warn("WhatsApp inbound dropped: organization not resolved", {
                sender: maskPhone(message.fromPhone),
                messageId: message.messageId,
            });
            continue;
        }

        const persisted = await handleInboundWhatsAppMessage({
            phoneNumberId: message.phoneNumberId,
            fromPhone: message.fromPhone,
            profileName: message.profileName,
            messageId: message.messageId,
            messageText: message.messageText,
            timestamp: message.timestamp,
            type: message.type,
            raw: message.raw,
        }, {
            organizationId: inboundOrg.organizationId,
            orgSlug: inboundOrg.orgSlug,
            dispatchCopilot: false,
        });

        if (!actorCtx) {
            logger.info("WhatsApp inbound stored without automation dispatch", {
                organizationId: persisted.tenant.organizationId,
                orgSlug: persisted.tenant.orgSlug,
                contactId: persisted.contact.id,
                conversationId: persisted.conversation.id,
                messageId: persisted.message.externalMessageId,
                dealId: persisted.deal.dealId,
                pipelineId: persisted.deal.pipelineId,
                stageId: persisted.deal.stageId,
                activityIds: persisted.deal.activityIds,
                sender: maskPhone(message.fromPhone),
            });
            dispatched += 1;
            continue;
        }

        const sessionId = await getOrCreateWhatsAppCopilotSession(actorCtx.orgId, message.fromPhone);
        routeWhatsAppMessage({
            from: message.fromPhone,
            text: message.messageText,
            orgId: actorCtx.orgId,
            userId: actorCtx.userId,
            role: actorCtx.role,
            sessionId,
        }).catch((error: Error) => {
            logger.error("Router error for WhatsApp inbound", {
                sender: maskPhone(message.fromPhone),
                error: error.message,
            });
        });

        logger.info("WhatsApp inbound dispatched", {
            organizationId: persisted.tenant.organizationId,
            orgSlug: persisted.tenant.orgSlug,
            contactId: persisted.contact.id,
            conversationId: persisted.conversation.id,
            messageId: persisted.message.externalMessageId,
            dealId: persisted.deal.dealId,
            pipelineId: persisted.deal.pipelineId,
            stageId: persisted.deal.stageId,
            activityIds: persisted.deal.activityIds,
            sender: maskPhone(message.fromPhone),
        });
        dispatched += 1;
    }

    return { ok: true, dispatched };
}
