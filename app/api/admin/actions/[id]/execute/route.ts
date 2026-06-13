import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { Orchestrator } from "@/lib/orchestrator/orchestrator";
import { can } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

async function POSTHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
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

        if (action.status !== "approved") {
            return new NextResponse("Para executar manualmente, a ação precisa estar aprovada (approved)", { status: 400 });
        }

        // Execute via Orchestrator!
        await Orchestrator.executeAction(id, session.orgId, session.userId);

        return NextResponse.json({ success: true, message: "Ação enviada para execução" });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export const POST = withApiLogging("/api/admin/actions/[id]/execute", "POST", POSTHandler);
