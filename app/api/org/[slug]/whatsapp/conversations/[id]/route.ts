import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { writeAuditEvent } from "@/lib/audit";

type ConversationAction = "close" | "reopen" | "block_contact";

function authErrorResponse(error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "ORG_NOT_FOUND") return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    if (typeof message === "string" && message.startsWith("FORBIDDEN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
}

function parseAction(value: unknown): ConversationAction | null {
    if (value === "close" || value === "reopen" || value === "block_contact") {
        return value;
    }
    return null;
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    try {
        const { slug, id: conversationId } = await params;
        const { orgId, role, userId } = await requireOrgContext(slug);
        const body = await request.json().catch(() => ({}));
        const action = parseAction(body.action);

        if (!action) {
            return NextResponse.json(
                { error: "Invalid action. Allowed: close, reopen, block_contact" },
                { status: 400 },
            );
        }

        const conversation = await prisma.whatsAppConversation.findUnique({
            where: { id: conversationId },
            include: {
                contact: {
                    select: { id: true, optedOutAt: true },
                },
            },
        });
        if (!conversation || conversation.organizationId !== orgId) {
            return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        if (role === "viewer") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (role === "closer" && conversation.assignedUserId !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (action === "close") {
            const updated = await prisma.whatsAppConversation.update({
                where: { id: conversationId },
                data: { status: "closed", unreadCount: 0 },
            });

            await writeAuditEvent({
                organizationId: orgId,
                action: "whatsappConversationClosed",
                details: { conversationId, byUserId: userId },
                strict: true,
                context: { conversationId },
            });

            return NextResponse.json({ ok: true, conversation: updated }, { status: 200 });
        }

        if (action === "reopen") {
            if (conversation.contact.optedOutAt) {
                return NextResponse.json({ error: "Blocked contacts cannot be reopened" }, { status: 409 });
            }

            const updated = await prisma.whatsAppConversation.update({
                where: { id: conversationId },
                data: {
                    status: "open",
                    slaDueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
                },
            });

            await writeAuditEvent({
                organizationId: orgId,
                action: "whatsappConversationReopened",
                details: { conversationId, byUserId: userId },
                strict: true,
                context: { conversationId },
            });

            return NextResponse.json({ ok: true, conversation: updated }, { status: 200 });
        }

        await prisma.$transaction([
            prisma.contact.update({
                where: { id: conversation.contact.id },
                data: {
                    optedOutAt: new Date(),
                    optOutReason: `manual_block:${userId}`,
                },
            }),
            prisma.whatsAppConversation.update({
                where: { id: conversationId },
                data: { status: "closed", unreadCount: 0 },
            }),
        ]);

        await writeAuditEvent({
            organizationId: orgId,
            action: "whatsappContactBlocked",
            details: { conversationId, contactId: conversation.contact.id, byUserId: userId },
            strict: true,
            context: { conversationId, contactId: conversation.contact.id },
        });

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
