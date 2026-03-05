import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp";

export async function POST(
    request: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const { orgId, role, userId } = await requireOrgContext(params.slug);
        const body = await request.json();

        const { conversationId, text, type = "text", templateKey } = body;

        if (!conversationId) {
            return NextResponse.json({ error: "conversationId required" }, { status: 400 });
        }

        const convo = await prisma.whatsAppConversation.findUnique({
            where: { id: conversationId },
            include: { contact: true }
        });

        if (!convo || convo.organizationId !== orgId) {
            return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        if (role === "sales" && convo.assignedUserId !== userId) {
            return NextResponse.json({ error: "Access Denied" }, { status: 403 });
        }

        const contact = convo.contact;
        const now = new Date();
        const isOutside24h = contact.sessionWindowUntil ? (contact.sessionWindowUntil < now) : true;

        if (type === "text" && isOutside24h) {
            return NextResponse.json({
                error: "Compliance Error",
                message: "A janela de 24h expirou. Você precisa enviar um Template aprovado para reengajar este contato."
            }, { status: 403 });
        }

        let sendResult;

        if (type === "text") {
            sendResult = await sendWhatsAppMessage(contact.phoneNumberE164, text);
        } else if (type === "template" && templateKey) {
            // For templates, we normally resolve parameters, but keeping simple for V36 baseline
            sendResult = await sendWhatsAppTemplate(contact.phoneNumberE164, templateKey, "pt_BR", []);
        } else {
            return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
        }

        if (sendResult.error) {
            return NextResponse.json({ error: "Meta API Error", details: sendResult.error }, { status: 502 });
        }

        // Persist outgoing message
        const msg = await prisma.whatsAppMessage.create({
            data: {
                conversationId: convo.id,
                messageId: sendResult.messageId || `out_${Date.now()}`,
                direction: "outbound",
                type: type,
                text: type === "text" ? text : `[Template: ${templateKey}]`,
                status: sendResult.stub ? "delivered" : "sent",
                sentAt: now,
            }
        });

        // Update contact lastOutboundAt
        await prisma.contact.update({
            where: { id: contact.id },
            data: { lastOutboundAt: now }
        });

        return NextResponse.json({ success: true, message: msg }, { status: 200 });

    } catch (e: any) {
        if (e.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        console.error("POST /send Error:", e);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
