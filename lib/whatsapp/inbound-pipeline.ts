import { processCopilotMessage } from "@/lib/ai/whatsapp-copilot";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { createSystemEvent } from "@/lib/system-events";
import { emitWebhookEvent } from "@/lib/public-api/webhooks";
import { setRequestContext } from "@/lib/observability/request-context";
import { recordOnboardingFirstContact } from "@/lib/onboarding-status";
import { routeInbound } from "@/lib/whatsapp/engines/assignment-engine";
import { calculateSlaDueDate } from "@/lib/whatsapp/engines/sla-engine";

import {
    buildContactSnapshot,
    buildConversationSnapshot,
    buildMessageSnapshot,
    ensureCanonicalDealLink,
} from "./crm-service";
import {
    mapSenderToTenantActor,
    resolveInboundTenantContext,
} from "./context-service";

import type {
    InboundWhatsAppPipelineResult,
    WhatsAppPipelineActor,
} from "./pipeline-contract";

export interface InboundMessage {
    from: string;
    messageId: string;
    text: string;
    timestamp: number;
    type: string;
    profileName?: string;
    raw: unknown;
}

export interface InboundWhatsAppMessageInput {
    phoneNumberId?: string | null;
    fromPhone: string;
    profileName?: string | null;
    messageId: string;
    messageText: string;
    timestamp: number;
    type: string;
    raw: unknown;
}

type PersistedInboundCore = {
    contact: ReturnType<typeof buildContactSnapshot>;
    conversation: ReturnType<typeof buildConversationSnapshot>;
    message: ReturnType<typeof buildMessageSnapshot>;
    isNewMessage: boolean;
    isNewContact: boolean;
};

function maskPhone(phone: string): string {
    if (phone.length <= 4) return "****";
    return `${"*".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
}

async function resolveInboundActor(phone: string, organizationId: string): Promise<WhatsAppPipelineActor> {
    const actor = await mapSenderToTenantActor(phone);
    if (!actor || actor.orgId !== organizationId) {
        return {
            source: "webhook",
            userId: null,
            role: "system",
            phoneNumber: phone,
        };
    }

    return {
        source: "tenant_user",
        userId: actor.userId,
        role: actor.role,
        phoneNumber: phone,
    };
}

async function findExistingInboundMessage(organizationId: string, externalMessageId: string) {
    const existingMessage = await prisma.whatsAppMessage.findUnique({
        where: { messageId: externalMessageId },
        select: {
            id: true,
            organizationId: true,
            conversationId: true,
            contactId: true,
            messageId: true,
            direction: true,
            type: true,
            text: true,
            status: true,
            sentAt: true,
            deliveredAt: true,
            readAt: true,
            failedAt: true,
            createdAt: true,
            contact: {
                select: {
                    id: true,
                    organizationId: true,
                    phoneNumberE164: true,
                    name: true,
                    optedOutAt: true,
                    sessionWindowUntil: true,
                    lastInboundAt: true,
                    lastOutboundAt: true,
                    lastMessageAt: true,
                },
            },
            conversation: {
                select: {
                    id: true,
                    organizationId: true,
                    contactId: true,
                    assignedUserId: true,
                    status: true,
                    unreadCount: true,
                    lastMessageAt: true,
                    lastMessagePreview: true,
                    slaDueAt: true,
                },
            },
        },
    });

    if (!existingMessage || existingMessage.organizationId !== organizationId) {
        return null;
    }

    return {
        contact: buildContactSnapshot(existingMessage.contact),
        conversation: buildConversationSnapshot(existingMessage.conversation),
        message: buildMessageSnapshot(existingMessage),
        isNewMessage: false,
        isNewContact: false,
    };
}

async function persistInboundMessageCore(
    organizationId: string,
    message: InboundMessage,
): Promise<PersistedInboundCore> {
    const existing = await findExistingInboundMessage(organizationId, message.messageId);
    if (existing) {
        return existing;
    }

    const timestamp = new Date(message.timestamp * 1000);
    const sessionWindowUntil = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000);
    const existingContact = await prisma.contact.findFirst({
        where: {
            organizationId,
            phoneNumberE164: message.from,
        },
        select: {
            id: true,
        },
    });

    const persisted = await prisma.$transaction(async (tx) => {
        const contact = await tx.contact.upsert({
            where: {
                organizationId_phoneNumberE164: {
                    organizationId,
                    phoneNumberE164: message.from,
                },
            },
            create: {
                organizationId,
                phoneNumberE164: message.from,
                wa_id: message.from,
                name: message.profileName || null,
                lastMessageAt: timestamp,
                lastInboundAt: timestamp,
                sessionWindowUntil,
            },
            update: {
                wa_id: message.from,
                name: message.profileName || undefined,
                lastMessageAt: timestamp,
                lastInboundAt: timestamp,
                sessionWindowUntil,
            },
            select: {
                id: true,
                organizationId: true,
                phoneNumberE164: true,
                name: true,
                optedOutAt: true,
                sessionWindowUntil: true,
                lastInboundAt: true,
                lastOutboundAt: true,
                lastMessageAt: true,
            },
        });

        const conversation = await tx.whatsAppConversation.upsert({
            where: {
                organizationId_contactId: {
                    organizationId,
                    contactId: contact.id,
                },
            },
            update: {
                status: "open",
                lastMessageAt: timestamp,
                lastMessagePreview: message.text,
                unreadCount: { increment: 1 },
                slaDueAt: calculateSlaDueDate(organizationId, timestamp),
            },
            create: {
                organizationId,
                contactId: contact.id,
                status: "open",
                slaDueAt: calculateSlaDueDate(organizationId, timestamp),
                lastMessageAt: timestamp,
                lastMessagePreview: message.text,
                unreadCount: 1,
            },
            select: {
                id: true,
                organizationId: true,
                contactId: true,
                assignedUserId: true,
                status: true,
                unreadCount: true,
                lastMessageAt: true,
                lastMessagePreview: true,
                slaDueAt: true,
            },
        });

        const createdMessage = await tx.whatsAppMessage.create({
            data: {
                organizationId,
                conversationId: conversation.id,
                contactId: contact.id,
                messageId: message.messageId,
                direction: "inbound",
                type: message.type,
                text: message.type === "text" ? message.text : null,
                status: "received",
                sentAt: timestamp,
                deliveredAt: timestamp,
                metaStatusPayload: JSON.stringify(message.raw),
            },
            select: {
                id: true,
                organizationId: true,
                conversationId: true,
                contactId: true,
                messageId: true,
                direction: true,
                type: true,
                text: true,
                status: true,
                sentAt: true,
                deliveredAt: true,
                readAt: true,
                failedAt: true,
                createdAt: true,
            },
        });

        return {
            contact: buildContactSnapshot(contact),
            conversation: buildConversationSnapshot(conversation),
            message: buildMessageSnapshot(createdMessage),
            isNewMessage: true,
            isNewContact: !existingContact,
        };
    });

    if (persisted.isNewContact) {
        void recordOnboardingFirstContact(organizationId).catch(() => undefined);
    }

    return persisted;
}

function describeInboundSideEffects(dispatchCopilot: boolean) {
    return {
        synchronous: [
            "contact_resolution",
            "conversation_resolution",
            "message_persistence",
            "canonical_deal_link",
            "activity_log",
        ],
        asyncCandidates: [
            "system_event",
            "assignment_routing",
            ...(dispatchCopilot ? ["copilot_dispatch"] : []),
        ],
    };
}

export async function handleInboundWhatsAppMessage(
    input: InboundWhatsAppMessageInput,
    options: {
        organizationId?: string | null;
        orgSlug?: string | null;
        dispatchCopilot?: boolean;
    } = {},
): Promise<InboundWhatsAppPipelineResult> {
    const tenant = await resolveInboundTenantContext({
        phoneNumberId: input.phoneNumberId,
        fromPhone: input.fromPhone,
        organizationId: options.organizationId,
        orgSlug: options.orgSlug,
    });

    setRequestContext({
        organizationId: tenant.organizationId,
        operation: "whatsapp_inbound",
    });

    const actor = await resolveInboundActor(input.fromPhone, tenant.organizationId);
    const persisted = await persistInboundMessageCore(tenant.organizationId, {
        from: input.fromPhone,
        messageId: input.messageId,
        text: input.messageText,
        timestamp: input.timestamp,
        type: input.type,
        profileName: input.profileName ?? undefined,
        raw: input.raw,
    });

    if (persisted.isNewContact) {
        void emitWebhookEvent({
            organizationId: tenant.organizationId,
            eventType: "contact.created",
            data: {
                contact: persisted.contact,
            },
        });
    }

    if (persisted.isNewMessage) {
        void emitWebhookEvent({
            organizationId: tenant.organizationId,
            eventType: "message.received",
            data: {
                channel: "whatsapp",
                contact: persisted.contact,
                conversation: persisted.conversation,
                message: persisted.message,
                deal: null,
            },
        });
    }

    const deal = persisted.isNewMessage
        ? await ensureCanonicalDealLink({
            organizationId: tenant.organizationId,
            contactId: persisted.contact.id,
            messageDirection: "inbound",
            messageText: input.messageText,
        }).catch((error: Error) => {
            logger.error("WhatsApp deal link failed", {
                organizationId: tenant.organizationId,
                contactId: persisted.contact.id,
                error: error.message,
            });
            return {
                dealId: null,
                pipelineId: null,
                stageId: null,
                created: false,
                reused: false,
                activityIds: [],
                messageActivityId: null,
                dealCreatedActivityId: null,
            };
        })
        : {
            dealId: null,
            pipelineId: null,
            stageId: null,
            created: false,
            reused: false,
            activityIds: [],
            messageActivityId: null,
            dealCreatedActivityId: null,
        };

    createSystemEvent({
        organizationId: tenant.organizationId,
        type: "whatsapp_inbound",
        severity: "info",
        message: "Inbound WhatsApp message received",
        entityType: "whatsapp_conversation",
        entityId: persisted.conversation.id,
        payloadJson: JSON.stringify({
            messageId: input.messageId,
            type: input.type,
            from: input.fromPhone,
        }),
    }).catch((error: Error) => {
        logger.error("WhatsApp inbound system event failed", {
            organizationId: tenant.organizationId,
            error: error.message,
        });
    });

    if (!persisted.conversation.assignedUserId) {
        routeInbound(persisted.contact.id, tenant.organizationId).then(async (assigneeId) => {
            if (assigneeId) {
                await prisma.whatsAppConversation.update({
                    where: { id: persisted.conversation.id },
                    data: { assignedUserId: assigneeId },
                });
            }
        }).catch((error: unknown) => {
            logger.error("WhatsApp assignment routing failed", {
                sender: maskPhone(input.fromPhone),
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }

    if ((options.dispatchCopilot ?? false) && input.type === "text" && input.messageText.trim()) {
        processCopilotMessage(input.fromPhone, input.messageText, input.messageId).catch((error: unknown) => {
            logger.error("WhatsApp copilot dispatch failed", {
                organizationId: tenant.organizationId,
                messageId: input.messageId,
                sender: maskPhone(input.fromPhone),
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }

    logger.info("[WhatsAppInboundCRM]", {
        organizationId: tenant.organizationId,
        contactId: persisted.contact.id,
        conversationId: persisted.conversation.id,
        messageId: input.messageId,
        dealId: deal.dealId,
        pipelineId: deal.pipelineId,
        stageId: deal.stageId,
        activityIds: deal.activityIds,
        isNewMessage: persisted.isNewMessage,
    });

    return {
        tenant,
        actor,
        contact: persisted.contact,
        conversation: persisted.conversation,
        message: persisted.message,
        deal,
        sideEffects: describeInboundSideEffects(Boolean(options.dispatchCopilot)),
        isNewMessage: persisted.isNewMessage,
    };
}
