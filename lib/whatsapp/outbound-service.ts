import type { Role } from "@/lib/auth/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppTemplateForOrg, sendWhatsAppTextForOrg } from "@/lib/whatsapp/meta-client";
import { setRequestContext } from "@/lib/observability/request-context";
import { getOrganizationAccountStatus, ORGANIZATION_BILLING_SUSPENDED_MESSAGE } from "@/lib/billing/account-status";

import {
    buildContactSnapshot,
    buildConversationSnapshot,
    buildMessageSnapshot,
    ensureCanonicalDealLink,
} from "./crm-service";
import {
    appendLedgerEvent,
    setCurrentLedgerState,
    updateMessageMetadataEnvelope,
} from "./message-ledger";
import { getScopedConversation } from "./conversation-service";

import type {
    OutboundWhatsAppPipelineResult,
    WhatsAppPipelineActor,
    WhatsAppPipelineTenantContext,
    WhatsAppSendType,
} from "./pipeline-contract";

export type SendBody = {
    conversationId?: string;
    text?: string;
    type?: "text" | "template";
    templateKey?: string;
    templateName?: string;
    templateLanguage?: string;
};

export type ParsedOutboundRequest = {
    conversationId: string;
    type: WhatsAppSendType;
    text: string;
    templateName: string;
    templateLanguage: string;
};

export type OutboundSendFailureCode =
    | "INVALID_JSON"
    | "MISSING_CONVERSATION_ID"
    | "MISSING_TEXT"
    | "MISSING_TEMPLATE_NAME"
    | "MISSING_TEMPLATE_LANGUAGE"
    | "CONVERSATION_NOT_FOUND"
    | "FORBIDDEN"
    | "CONTACT_OPTED_OUT"
    | "OUTSIDE_24H_WINDOW"
    | "TEMPLATE_NAME_LANGUAGE_NOT_FOUND"
    | "TEMPLATE_NOT_APPROVED"
    | "META_NOT_CONFIGURED"
    | "META_SEND_FAILED";

export type OutboundSendFailure = {
    ok: false;
    code: OutboundSendFailureCode;
    status: number;
    message: string;
    auditReason: string;
    conversationId?: string;
    details?: Record<string, unknown>;
};

export type OutboundSendSuccess = {
    ok: true;
    result: OutboundWhatsAppPipelineResult;
};

export type OutboundSendResult = OutboundSendFailure | OutboundSendSuccess;

function buildTenantContext(organizationId: string): WhatsAppPipelineTenantContext {
    return {
        organizationId,
        orgSlug: null,
    };
}

function buildActor(userId: string, role: Role | string): WhatsAppPipelineActor {
    return {
        source: "tenant_user",
        userId,
        role: role as Role,
        phoneNumber: null,
    };
}

function buildOutboundMessageErrorJson(input: {
    type: WhatsAppSendType;
    text: string;
    templateName: string;
    templateLanguage: string;
    externalMessageId: string | null;
    at: Date;
}): string {
    return updateMessageMetadataEnvelope(null, (envelope) => {
        envelope.metadata.outboundRequest = input.type === "template"
            ? {
                type: "template",
                templateName: input.templateName,
                templateLanguage: input.templateLanguage,
            }
            : {
                type: "text",
                text: input.text,
            };
        appendLedgerEvent(envelope.ledger, {
            at: input.at,
            source: "outbound_send",
            externalMessageId: input.externalMessageId,
            lifecycleStatus: "sent",
            providerStatus: "sent",
            note: "initial_outbound_send",
        });
        setCurrentLedgerState(envelope.ledger, {
            lifecycleStatus: "sent",
            failureClass: null,
            externalMessageId: input.externalMessageId,
            eventAt: input.at,
        });
        return envelope;
    });
}

async function writeSendRejectedAudit(input: {
    organizationId: string;
    actorUserId: string;
    conversationId?: string;
    reason: string;
    type?: WhatsAppSendType;
    details?: Record<string, unknown>;
}) {
    await writeAuditEvent({
        organizationId: input.organizationId,
        action: "whatsappMessageSendRejected",
        details: {
            actorUserId: input.actorUserId,
            conversationId: input.conversationId ?? null,
            reason: input.reason,
            type: input.type ?? null,
            ...input.details,
        },
        strict: false,
        context: { conversationId: input.conversationId, reason: input.reason },
    });
}

export function parseOutboundSendBody(body: unknown): ParsedOutboundRequest | OutboundSendFailure {
    if (!body || typeof body !== "object") {
        return {
            ok: false,
            code: "INVALID_JSON",
            status: 400,
            message: "Invalid JSON",
            auditReason: "INVALID_JSON",
        };
    }

    const parsed = body as SendBody;
    const conversationId = typeof parsed.conversationId === "string" ? parsed.conversationId.trim() : "";
    const type = parsed.type === "template" ? "template" : "text";
    const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
    const templateName = typeof parsed.templateName === "string"
        ? parsed.templateName.trim()
        : typeof parsed.templateKey === "string"
            ? parsed.templateKey.trim()
            : "";
    const templateLanguage = typeof parsed.templateLanguage === "string" ? parsed.templateLanguage.trim() : "";

    if (!conversationId) {
        return {
            ok: false,
            code: "MISSING_CONVERSATION_ID",
            status: 400,
            message: "conversationId required",
            auditReason: "MISSING_CONVERSATION_ID",
        };
    }

    if (type === "text" && !text) {
        return {
            ok: false,
            code: "MISSING_TEXT",
            status: 400,
            message: "text required for text messages",
            auditReason: "MISSING_TEXT",
            conversationId,
        };
    }

    if (type === "template" && !templateName) {
        return {
            ok: false,
            code: "MISSING_TEMPLATE_NAME",
            status: 400,
            message: "templateName required for template messages",
            auditReason: "MISSING_TEMPLATE_NAME",
            conversationId,
        };
    }

    if (type === "template" && !templateLanguage) {
        return {
            ok: false,
            code: "MISSING_TEMPLATE_LANGUAGE",
            status: 400,
            message: "templateLanguage required for template messages",
            auditReason: "MISSING_TEMPLATE_LANGUAGE",
            conversationId,
            details: { code: "TEMPLATE_LANGUAGE_REQUIRED", templateName },
        };
    }

    return {
        conversationId,
        type,
        text,
        templateName,
        templateLanguage,
    };
}

export async function sendOutboundWhatsAppMessage(input: {
    organizationId: string;
    role: Role | string;
    userId: string;
    request: ParsedOutboundRequest;
}): Promise<OutboundSendResult> {
    const { organizationId, role, userId, request } = input;
    setRequestContext({
        organizationId,
        userId,
        operation: "whatsapp_outbound",
    });

    if (await getOrganizationAccountStatus(organizationId) === "suspended") {
        await writeSendRejectedAudit({
            organizationId,
            actorUserId: userId,
            conversationId: request.conversationId,
            reason: "ACCOUNT_SUSPENDED",
            type: request.type,
        });

        return {
            ok: false,
            code: "FORBIDDEN",
            status: 403,
            message: ORGANIZATION_BILLING_SUSPENDED_MESSAGE,
            auditReason: "ACCOUNT_SUSPENDED",
            conversationId: request.conversationId,
        };
    }

    const scoped = await getScopedConversation({
        organizationId,
        conversationId: request.conversationId,
        role,
        userId,
    }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "CONVERSATION_NOT_FOUND") {
            return null;
        }
        throw error;
    });

    if (!scoped) {
        await writeSendRejectedAudit({
            organizationId,
            actorUserId: userId,
            conversationId: request.conversationId,
            reason: "CONVERSATION_NOT_FOUND",
            type: request.type,
        });
        return {
            ok: false,
            code: "CONVERSATION_NOT_FOUND",
            status: 404,
            message: "Conversation not found",
            auditReason: "CONVERSATION_NOT_FOUND",
            conversationId: request.conversationId,
        };
    }

    const { conversation, contact } = scoped;

    if (role === "viewer") {
        await writeSendRejectedAudit({
            organizationId,
            actorUserId: userId,
            conversationId: conversation.id,
            reason: "ROLE_VIEWER_FORBIDDEN",
            type: request.type,
        });
        return {
            ok: false,
            code: "FORBIDDEN",
            status: 403,
            message: "Viewer role cannot send messages",
            auditReason: "ROLE_VIEWER_FORBIDDEN",
            conversationId: conversation.id,
        };
    }

    if (role === "closer" && conversation.assignedUserId !== userId) {
        await writeSendRejectedAudit({
            organizationId,
            actorUserId: userId,
            conversationId: conversation.id,
            reason: "CLOSER_NOT_ASSIGNED",
            type: request.type,
        });
        return {
            ok: false,
            code: "FORBIDDEN",
            status: 403,
            message: "Closer can only message assigned conversations",
            auditReason: "CLOSER_NOT_ASSIGNED",
            conversationId: conversation.id,
        };
    }

    if (contact.optedOutAt) {
        await writeSendRejectedAudit({
            organizationId,
            actorUserId: userId,
            conversationId: conversation.id,
            reason: "CONTACT_OPTED_OUT",
            type: request.type,
        });
        return {
            ok: false,
            code: "CONTACT_OPTED_OUT",
            status: 409,
            message: "Contact is blocked/opted-out",
            auditReason: "CONTACT_OPTED_OUT",
            conversationId: conversation.id,
        };
    }

    const now = new Date();
    const isOutside24h = contact.sessionWindowUntil ? contact.sessionWindowUntil < now : true;
    if (request.type === "text" && isOutside24h) {
        await writeSendRejectedAudit({
            organizationId,
            actorUserId: userId,
            conversationId: conversation.id,
            reason: "OUTSIDE_24H_WINDOW",
            type: request.type,
        });
        return {
            ok: false,
            code: "OUTSIDE_24H_WINDOW",
            status: 403,
            message: "A janela de 24h expirou. Envie um template aprovado para reengajar este contato.",
            auditReason: "OUTSIDE_24H_WINDOW",
            conversationId: conversation.id,
        };
    }

    let externalMessageId: string | null = null;
    let effectiveText = request.text;

    if (request.type === "text") {
        const providerResult = await sendWhatsAppTextForOrg(organizationId, contact.phoneNumberE164, request.text);
        if (!providerResult.messageId) {
            const error = providerResult.error ?? "META_SEND_FAILED";
            await writeSendRejectedAudit({
                organizationId,
                actorUserId: userId,
                conversationId: conversation.id,
                reason: error,
                type: request.type,
            });
            return {
                ok: false,
                code: error === "META_NOT_CONFIGURED" ? "META_NOT_CONFIGURED" : "META_SEND_FAILED",
                status: error === "META_NOT_CONFIGURED" ? 503 : 502,
                message: "Meta API Error",
                auditReason: error,
                conversationId: conversation.id,
                details: { error },
            };
        }
        externalMessageId = providerResult.messageId;
    } else {
        const template = await prisma.whatsAppTemplate.findFirst({
            where: {
                organizationId,
                name: request.templateName,
                language: request.templateLanguage,
            },
            select: { name: true, status: true, language: true },
        });

        if (!template) {
            const availableLanguages = await prisma.whatsAppTemplate.findMany({
                where: { organizationId, name: request.templateName },
                select: { language: true },
            });

            await writeSendRejectedAudit({
                organizationId,
                actorUserId: userId,
                conversationId: conversation.id,
                reason: "TEMPLATE_NAME_LANGUAGE_NOT_FOUND",
                type: request.type,
                details: {
                    templateName: request.templateName,
                    templateLanguage: request.templateLanguage,
                    availableLanguages: availableLanguages.map((item) => item.language),
                },
            });

            return {
                ok: false,
                code: "TEMPLATE_NAME_LANGUAGE_NOT_FOUND",
                status: 422,
                message: "Template name/language not found in this organization",
                auditReason: "TEMPLATE_NAME_LANGUAGE_NOT_FOUND",
                conversationId: conversation.id,
                details: { availableLanguages: availableLanguages.map((item) => item.language) },
            };
        }

        if (template.status !== "approved") {
            await writeSendRejectedAudit({
                organizationId,
                actorUserId: userId,
                conversationId: conversation.id,
                reason: "TEMPLATE_NOT_APPROVED",
                type: request.type,
                details: {
                    templateName: template.name,
                    templateLanguage: template.language,
                },
            });

            return {
                ok: false,
                code: "TEMPLATE_NOT_APPROVED",
                status: 409,
                message: "Template is not approved",
                auditReason: "TEMPLATE_NOT_APPROVED",
                conversationId: conversation.id,
            };
        }

        const providerResult = await sendWhatsAppTemplateForOrg(
            organizationId,
            contact.phoneNumberE164,
            template.name,
            template.language,
            [],
        );
        if (!providerResult.messageId) {
            const error = providerResult.error ?? "META_SEND_FAILED";
            await writeSendRejectedAudit({
                organizationId,
                actorUserId: userId,
                conversationId: conversation.id,
                reason: error,
                type: request.type,
                details: {
                    templateName: template.name,
                    templateLanguage: template.language,
                },
            });
            return {
                ok: false,
                code: error === "META_NOT_CONFIGURED" ? "META_NOT_CONFIGURED" : "META_SEND_FAILED",
                status: error === "META_NOT_CONFIGURED" ? 503 : 502,
                message: "Meta API Error",
                auditReason: error,
                conversationId: conversation.id,
                details: { error },
            };
        }

        externalMessageId = providerResult.messageId;
        effectiveText = `[Template: ${template.name} (${template.language})]`;
    }

    const message = await prisma.whatsAppMessage.create({
        data: {
            organizationId,
            conversationId: conversation.id,
            contactId: contact.id,
            messageId: externalMessageId,
            direction: "outbound",
            type: request.type,
            text: effectiveText,
            status: "sent",
            sentAt: now,
            errorJson: buildOutboundMessageErrorJson({
                type: request.type,
                text: effectiveText,
                templateName: request.templateName,
                templateLanguage: request.templateLanguage,
                externalMessageId,
                at: now,
            }),
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

    const [updatedContact, updatedConversation] = await prisma.$transaction([
        prisma.contact.update({
            where: { id: contact.id },
            data: { lastOutboundAt: now, lastMessageAt: now },
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
        }),
        prisma.whatsAppConversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: now,
                lastMessagePreview: effectiveText,
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
        }),
    ]);

    const deal = await ensureCanonicalDealLink({
        organizationId,
        contactId: contact.id,
        messageDirection: "outbound",
        messageText: effectiveText,
    });

    await writeAuditEvent({
        organizationId,
        action: "whatsappMessageSent",
        details: {
            conversationId: conversation.id,
            contactId: contact.id,
            messageId: message.id,
            direction: "outbound",
            type: request.type,
            actorUserId: userId,
            dealId: deal.dealId,
        },
        strict: true,
        context: { conversationId: conversation.id, messageId: message.id },
    });

    return {
        ok: true,
        result: {
            tenant: buildTenantContext(organizationId),
            actor: buildActor(userId, role),
            contact: buildContactSnapshot(updatedContact),
            conversation: buildConversationSnapshot(updatedConversation),
            message: buildMessageSnapshot(message),
            deal,
            sideEffects: {
                synchronous: [
                    "provider_send",
                    "message_persistence",
                    "contact_touch",
                    "conversation_touch",
                    "canonical_deal_link",
                    "activity_log",
                    "audit_event",
                ],
                asyncCandidates: [
                    "provider_status_webhook_reconciliation",
                    "provider_retry_strategy",
                    "analytics_rollup",
                ],
            },
        },
    };
}
