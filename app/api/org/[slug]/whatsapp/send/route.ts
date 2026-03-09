import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { writeAuditEvent } from "@/lib/audit";
import { sendWhatsAppTemplateForOrg, sendWhatsAppTextForOrg } from "@/lib/whatsapp/meta-client";

type SendBody = {
    conversationId?: string;
    text?: string;
    type?: "text" | "template";
    templateKey?: string;
    templateName?: string;
    templateLanguage?: string;
};

async function writeSendRejectedAudit(input: {
    organizationId: string;
    actorUserId: string;
    conversationId?: string;
    reason: string;
    type?: "text" | "template";
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

function authErrorResponse(error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "ORG_NOT_FOUND") return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    if (typeof message === "string" && message.startsWith("FORBIDDEN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { orgId, role, userId } = await requireOrgContext((await params).slug);
        const body = await request.json().catch(() => ({} as SendBody));

        const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
        const sendType = body.type === "template" ? "template" : "text";
        const text = typeof body.text === "string" ? body.text.trim() : "";
        const templateNameInput = typeof body.templateName === "string"
            ? body.templateName.trim()
            : typeof body.templateKey === "string"
                ? body.templateKey.trim()
                : "";
        const templateLanguageInput = typeof body.templateLanguage === "string" ? body.templateLanguage.trim() : "";

        if (!conversationId) {
            await writeSendRejectedAudit({ organizationId: orgId, actorUserId: userId, reason: "MISSING_CONVERSATION_ID", type: sendType });
            return NextResponse.json({ error: "conversationId required" }, { status: 400 });
        }
        if (sendType === "text" && !text) {
            await writeSendRejectedAudit({ organizationId: orgId, actorUserId: userId, conversationId, reason: "MISSING_TEXT", type: sendType });
            return NextResponse.json({ error: "text required for text messages" }, { status: 400 });
        }
        if (sendType === "template" && !templateNameInput) {
            await writeSendRejectedAudit({ organizationId: orgId, actorUserId: userId, conversationId, reason: "MISSING_TEMPLATE_NAME", type: sendType });
            return NextResponse.json({ error: "templateName required for template messages" }, { status: 422 });
        }
        if (sendType === "template" && !templateLanguageInput) {
            await writeSendRejectedAudit({ organizationId: orgId, actorUserId: userId, conversationId, reason: "MISSING_TEMPLATE_LANGUAGE", type: sendType, details: { templateName: templateNameInput } });
            return NextResponse.json({ error: "templateLanguage required for template messages", code: "TEMPLATE_LANGUAGE_REQUIRED" }, { status: 422 });
        }

        const conversation = await prisma.whatsAppConversation.findUnique({
            where: { id: conversationId },
            include: { contact: true },
        });
        if (!conversation || conversation.organizationId !== orgId) {
            await writeSendRejectedAudit({ organizationId: orgId, actorUserId: userId, conversationId, reason: "CONVERSATION_NOT_FOUND", type: sendType });
            return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        if (role === "viewer") {
            await writeSendRejectedAudit({ organizationId: orgId, actorUserId: userId, conversationId: conversation.id, reason: "ROLE_VIEWER_FORBIDDEN", type: sendType });
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
        if (role === "closer" && conversation.assignedUserId !== userId) {
            await writeSendRejectedAudit({ organizationId: orgId, actorUserId: userId, conversationId: conversation.id, reason: "CLOSER_NOT_ASSIGNED", type: sendType });
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        if (conversation.contact.optedOutAt) {
            await writeSendRejectedAudit({ organizationId: orgId, actorUserId: userId, conversationId: conversation.id, reason: "CONTACT_OPTED_OUT", type: sendType });
            return NextResponse.json({ error: "Contact is blocked/opted-out" }, { status: 409 });
        }

        const now = new Date();
        const isOutside24h = conversation.contact.sessionWindowUntil
            ? conversation.contact.sessionWindowUntil < now
            : true;

        if (sendType === "text" && isOutside24h) {
            await writeSendRejectedAudit({ organizationId: orgId, actorUserId: userId, conversationId: conversation.id, reason: "OUTSIDE_24H_WINDOW", type: sendType });
            return NextResponse.json({
                error: "Compliance Error",
                message: "A janela de 24h expirou. Envie um template aprovado para reengajar este contato.",
            }, { status: 403 });
        }

        let messageId: string | null = null;
        let effectiveText = text;

        if (sendType === "text") {
            const result = await sendWhatsAppTextForOrg(orgId, conversation.contact.phoneNumberE164, text);
            if (!result.messageId) {
                const status = result.error === "META_NOT_CONFIGURED" ? 503 : 502;
                await writeSendRejectedAudit({ organizationId: orgId, actorUserId: userId, conversationId: conversation.id, reason: result.error ?? "META_SEND_FAILED", type: sendType });
                return NextResponse.json({ error: "Meta API Error", details: result.error ?? "UNKNOWN" }, { status });
            }
            messageId = result.messageId;
        } else {
            const template = await prisma.whatsAppTemplate.findFirst({
                where: {
                    organizationId: orgId,
                    name: templateNameInput,
                    language: templateLanguageInput,
                },
                select: { name: true, status: true, language: true },
            });

            if (!template) {
                const sameName = await prisma.whatsAppTemplate.findMany({
                    where: { organizationId: orgId, name: templateNameInput },
                    select: { language: true },
                });
                await writeSendRejectedAudit({
                    organizationId: orgId,
                    actorUserId: userId,
                    conversationId: conversation.id,
                    reason: "TEMPLATE_NAME_LANGUAGE_NOT_FOUND",
                    type: sendType,
                    details: {
                        templateName: templateNameInput,
                        templateLanguage: templateLanguageInput,
                        availableLanguages: sameName.map((item) => item.language),
                    },
                });
                return NextResponse.json({
                    error: "Template name/language not found in this organization",
                    code: "TEMPLATE_NAME_LANGUAGE_NOT_FOUND",
                    availableLanguages: sameName.map((item) => item.language),
                }, { status: 422 });
            }

            if (template.status !== "approved") {
                await writeSendRejectedAudit({ organizationId: orgId, actorUserId: userId, conversationId: conversation.id, reason: "TEMPLATE_NOT_APPROVED", type: sendType, details: { templateName: template.name, templateLanguage: template.language } });
                return NextResponse.json({ error: "Template is not approved" }, { status: 409 });
            }

            const result = await sendWhatsAppTemplateForOrg(
                orgId,
                conversation.contact.phoneNumberE164,
                template.name,
                template.language,
                [],
            );
            if (!result.messageId) {
                const status = result.error === "META_NOT_CONFIGURED" ? 503 : 502;
                await writeSendRejectedAudit({ organizationId: orgId, actorUserId: userId, conversationId: conversation.id, reason: result.error ?? "META_SEND_FAILED", type: sendType, details: { templateName: template.name, templateLanguage: template.language } });
                return NextResponse.json({ error: "Meta API Error", details: result.error ?? "UNKNOWN" }, { status });
            }
            messageId = result.messageId;
            effectiveText = `[Template: ${template.name} (${template.language})]`;
        }

        const message = await prisma.whatsAppMessage.create({
            data: {
                conversationId: conversation.id,
                messageId,
                direction: "outbound",
                type: sendType,
                text: effectiveText,
                status: "sent",
                sentAt: now,
            },
        });

        await prisma.$transaction([
            prisma.contact.update({
                where: { id: conversation.contact.id },
                data: { lastOutboundAt: now, lastMessageAt: now },
            }),
            prisma.whatsAppConversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: now,
                    lastMessagePreview: effectiveText,
                },
            }),
        ]);

        await writeAuditEvent({
            organizationId: orgId,
            action: "whatsappMessageSent",
            details: {
                conversationId: conversation.id,
                contactId: conversation.contact.id,
                messageId: message.id,
                direction: "outbound",
                type: sendType,
                actorUserId: userId,
            },
            strict: true,
            context: { conversationId: conversation.id, messageId: message.id },
        });

        return NextResponse.json({ success: true, message }, { status: 200 });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
