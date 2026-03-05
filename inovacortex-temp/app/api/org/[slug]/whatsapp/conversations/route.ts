import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { can } from "@/lib/auth/rbac";

export async function GET(
    request: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const { orgId, role, userId } = await requireOrgContext(params.slug);

        const { searchParams } = new URL(request.url);
        const unreadOnly = searchParams.get("unread") === "true";
        const status = searchParams.get("status") || "open";

        // Security: If user is "sales", restrict them to their assigned conversations
        // Wait, WhatsAppConversation holds `assignedUserId`, so we filter by it.
        const isSales = role === "sales";

        const whereClause: any = {
            organizationId: orgId,
            status: status
        };

        if (unreadOnly) {
            whereClause.unreadCount = { gt: 0 };
        }

        if (isSales) {
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
                        lastOutboundAt: true,
                        sessionWindowUntil: true
                    }
                },
                user: {
                    select: {
                        name: true,
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

        // Add dynamically calculated 24h compliance flag for the client
        const now = new Date();
        const payload = conversations.map(c => {
            const isOutside24h = c.contact.sessionWindowUntil ? (c.contact.sessionWindowUntil < now) : true;
            return { ...c, isOutside24h };
        });

        return NextResponse.json({ conversations: payload }, { status: 200 });
    } catch (e: any) {
        if (e.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        console.error("GET /conversations Error:", e);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
