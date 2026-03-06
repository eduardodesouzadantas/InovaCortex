import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processCopilotMessage } from "@/lib/ai/whatsapp-copilot";
import { routeInbound } from "@/lib/whatsapp/engines/assignment-engine";
import { calculateSlaDueDate } from "@/lib/whatsapp/engines/sla-engine";

export const runtime = "nodejs";

// GET — Meta Webhook Verification
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Helper to determine the Organization from the system's Phone Number ID
// In a fully multi-tenant Meta App, you would map `phoneNumberId` -> `Organization`
async function resolveOrgIdForWebhook(phoneNumberId: string): Promise<string | null> {
    const org = await prisma.organization.findFirst();
    return org?.id || null;
}

// POST — Meta Webhook Events
export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (!body.object) {
            return NextResponse.json({ error: "Invalid body" }, { status: 400 });
        }

        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                const value = change.value;
                const metadata = value.metadata;
                const phoneNumberId = metadata?.phone_number_id;

                if (!phoneNumberId) continue;

                const orgId = await resolveOrgIdForWebhook(phoneNumberId);
                if (!orgId) continue;

                // A) Status Updates
                if (value.statuses) {
                    for (const status of value.statuses) {
                        await handleStatusUpdate(status);
                    }
                }

                // B) Inbound Messages
                if (value.messages) {
                    for (const msg of value.messages) {
                        await handleInboundMessage(orgId, msg);
                    }
                }
            }
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (e) {
        console.error("Webhook Error:", e);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

async function handleStatusUpdate(statusData: any) {
    const wamid = statusData.id;
    const newStatus = statusData.status;
    const timestamp = new Date(parseInt(statusData.timestamp) * 1000);

    const updateData: any = {
        status: newStatus,
        metaStatusPayload: JSON.stringify(statusData)
    };

    if (newStatus === "sent") updateData.sentAt = timestamp;
    if (newStatus === "delivered") updateData.deliveredAt = timestamp;
    if (newStatus === "read") updateData.readAt = timestamp;
    if (newStatus === "failed") {
        updateData.failedAt = timestamp;
        if (statusData.errors) updateData.errorJson = JSON.stringify(statusData.errors);
    }

    try {
        const msg = await prisma.whatsAppMessage.findUnique({ where: { messageId: wamid } });
        if (msg) {
            await prisma.whatsAppMessage.update({
                where: { id: msg.id },
                data: updateData
            });
            // Log System Event for Status Update
            await prisma.systemEvent.create({
                data: {
                    organizationId: "webhook_system", // Status updates might not have direct org context in this simplified logic
                    type: "whatsapp_status",
                    severity: "info",
                    message: `Status: ${statusData.status} (${statusData.id})`,
                    payloadJson: JSON.stringify(statusData)
                }
            });
        } else {
            // Check legacy MessageLog just in case
            const log = await (prisma as any).messageLog?.findFirst({
                where: { payloadRedacted: { contains: wamid } }
            });
            if (log) {
                await (prisma as any).messageLog.update({
                    where: { id: log.id },
                    data: {
                        status: newStatus,
                        payloadRedacted: JSON.stringify({ wamid, lastStatus: newStatus })
                    }
                });
            }
        }
    } catch (e) {
        console.error("Failed to update status for wamid", wamid, e);
    }
}

async function handleInboundMessage(orgId: string, msg: any) {
    const fromPhone = msg.from;
    const messageId = msg.id;
    const timestamp = new Date(parseInt(msg.timestamp) * 1000);
    const sessionWindowLimit = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000); // +24 hours

    const messageText = msg.type === "text" ? msg.text?.body : `[${msg.type} message]`;

    // 1. Upsert Contact to maintain the 24h compliance window
    const contact = await prisma.contact.upsert({
        where: {
            organizationId_phoneNumberE164: {
                organizationId: orgId,
                phoneNumberE164: fromPhone
            }
        },
        create: {
            organizationId: orgId,
            phoneNumberE164: fromPhone,
            name: msg.profile?.name || "Unknown",
            lastMessageAt: timestamp,
            lastInboundAt: timestamp,
            sessionWindowUntil: sessionWindowLimit
        },
        update: {
            lastMessageAt: timestamp,
            lastInboundAt: timestamp,
            sessionWindowUntil: sessionWindowLimit,
            name: msg.profile?.name ? msg.profile.name : undefined
        }
    });

    // Log System Event for Observability
    await prisma.systemEvent.create({
        data: {
            organizationId: orgId,
            type: "whatsapp_inbound",
            severity: "info",
            message: `Msg recebida de ${fromPhone}`,
            payloadJson: JSON.stringify({ messageId, from: fromPhone, type: msg.type })
        }
    });

    // 2. Find or Create Open Conversation
    let conversation = await prisma.whatsAppConversation.findFirst({
        where: {
            organizationId: orgId,
            contactId: contact.id,
            status: { in: ["open", "snoozed"] }
        }
    });

    if (!conversation) {
        // Create new conversation
        conversation = await prisma.whatsAppConversation.create({
            data: {
                organizationId: orgId,
                contactId: contact.id,
                status: "open",
                slaDueAt: calculateSlaDueDate(orgId, timestamp),
                lastMessageAt: timestamp,
                lastMessagePreview: messageText,
                unreadCount: 1
            }
        });

        // Run assignment engine asynchronously
        routeInbound(contact.id, orgId).then(async (assigneeId) => {
            if (assigneeId) {
                await prisma.whatsAppConversation.update({
                    where: { id: conversation!.id },
                    data: { assignedUserId: assigneeId }
                });
            }
        }).catch(err => console.error("Assignment Engine Error:", err));
    } else {
        // Update existing conversation
        await prisma.whatsAppConversation.update({
            where: { id: conversation.id },
            data: {
                status: "open", // Wake up if snoozed
                lastMessageAt: timestamp,
                lastMessagePreview: messageText,
                unreadCount: { increment: 1 },
                // Only reset SLA if it's not currently breaching? Simplified: reset SLA for new inbound.
                slaDueAt: calculateSlaDueDate(orgId, timestamp)
            }
        });
    }

    // 3. Persist the actual WhatsAppMessage
    await prisma.whatsAppMessage.create({
        data: {
            conversationId: conversation.id,
            messageId: messageId,
            direction: "inbound",
            type: msg.type || "text",
            text: msg.type === "text" ? msg.text?.body : null,
            status: "received",
            sentAt: timestamp,
            deliveredAt: timestamp,
            metaStatusPayload: JSON.stringify(msg)
        }
    });

    // 4. Pass to the AI Copilot for autonomous handling
    if (msg.type === "text" && msg.text?.body) {
        processCopilotMessage(fromPhone, msg.text.body, msg.id)
            .catch(err => console.error("[Copilot] Error:", err));
    }
}
