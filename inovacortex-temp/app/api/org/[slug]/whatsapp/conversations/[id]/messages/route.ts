import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";

export async function GET(
    request: Request,
    { params }: { params: { slug: string, id: string } }
) {
    try {
        const { orgId, role, userId } = await requireOrgContext(params.slug);
        const conversationId = params.id;

        // 1. Verify existence and authorization
        const convo = await prisma.whatsAppConversation.findUnique({
            where: { id: conversationId }
        });

        if (!convo || convo.organizationId !== orgId) {
            return NextResponse.json({ error: "Not Found" }, { status: 404 });
        }

        if (role === "sales" && convo.assignedUserId !== userId) {
            return NextResponse.json({ error: "Access Denied" }, { status: 403 });
        }

        // 2. Fetch Messages (paginate cursor if needed, keeping it simple for now)
        const messages = await prisma.whatsAppMessage.findMany({
            where: { conversationId: conversationId },
            orderBy: { createdAt: "asc" }, // Oldest to newest
            take: 200 // Max limit for full context
        });

        // 3. Mark as Read logically: Reset unreadCount to 0
        if (convo.unreadCount > 0) {
            await prisma.whatsAppConversation.update({
                where: { id: conversationId },
                data: { unreadCount: 0 }
            });
        }

        return NextResponse.json({ messages }, { status: 200 });

    } catch (e: any) {
        if (e.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        console.error("GET /messages Error:", e);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
