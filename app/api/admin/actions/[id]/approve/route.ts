import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        // Closers can approve content, admins too
        if (!session || !can(session.role, "updateLeadStatus")) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { id } = await params;

        const action = await (prisma as any).actionQueue.findUnique({
            where: { id }
        });

        if (!action || action.organizationId !== session.orgId) {
            return new NextResponse("Not found", { status: 404 });
        }

        if (action.status !== "review_required") {
            return new NextResponse("Action not in review state", { status: 400 });
        }

        await (prisma as any).actionQueue.update({
            where: { id },
            data: {
                status: "approved",
                approvedBy: session.userId,
                approvedAt: new Date(),
                lockedByRunId: null,
                lockedUntil: null
            }
        });

        await (prisma as any).auditEvent.create({
            data: {
                organizationId: session.orgId,
                action: "approved",
                userId: session.userId,
                resourceType: "action_queue",
                resourceId: id,
                ipAddress: "system"
            }
        });

        return NextResponse.json({ success: true, message: "Aprovado com sucesso" });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
