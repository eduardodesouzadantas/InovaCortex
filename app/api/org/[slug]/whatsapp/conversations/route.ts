import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { orgId, role, userId } = await requireOrgContext((await params).slug);

        const { searchParams } = new URL(request.url);
        const unreadOnly = searchParams.get("unread") === "true";
        const requestedStatus = searchParams.get("status");
        const status = requestedStatus === "closed" || requestedStatus === "snoozed" ? requestedStatus : "open";

        const isCloser = role === "closer";

        const whereClause: Prisma.WhatsAppConversationWhereInput = {
            organizationId: orgId,
            status,
        };

        if (unreadOnly) {
            whereClause.unreadCount = { gt: 0 };
        }

        if (isCloser) {
            whereClause.assignedUserId = userId;
        }

        const conversations = await prisma.whatsAppConversation.findMany({
            where: whereClause,
            include: {
                contact: {
                    select: {
                        name: true,
                        phoneNumberE164: true,
                        tags: true,
                        lifecycle: true,
                        optedOutAt: true,
                        lastOutboundAt: true,
                        sessionWindowUntil: true
                    }
                },
                user: {
                    select: {
                        email: true
                    }
                }
            },
            orderBy: [
                { unreadCount: "desc" },     // Unread first
                { slaDueAt: "asc" },         // Then SLA closest to breaching
                { lastMessageAt: "desc" }    // Finally, most recently active
            ],
            take: 50
        });

        const now = new Date();
        const payload = conversations.map((conversation) => {
            const isOutside24h = conversation.contact?.sessionWindowUntil
                ? new Date(conversation.contact.sessionWindowUntil) < now
                : true;
            return { ...conversation, isOutside24h };
        });

        return NextResponse.json({ conversations: payload }, { status: 200 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "";
        if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (message === "ORG_NOT_FOUND") return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        if (message.startsWith("FORBIDDEN")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        console.error("GET /conversations Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
