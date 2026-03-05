import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { Orchestrator } from "@/lib/orchestrator/orchestrator";
import { can } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session || !can(session.role, "manageSettings")) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { previewOnly } = body;

        // Fetch context
        const recentLeads = await (prisma as any).assessment.findMany({
            where: { organizationId: session.orgId },
            orderBy: { createdAt: "desc" },
            take: 5
        });

        const ctx = {
            orgId: session.orgId,
            userId: session.userId,
            recentLeads
        };

        const plannedActions = await Orchestrator.plan(ctx);

        if (!previewOnly) {
            for (const action of plannedActions) {
                await Orchestrator.enqueue(action, ctx);
            }
        }

        return NextResponse.json({ success: true, count: plannedActions.length, actions: plannedActions });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
