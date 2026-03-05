import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
import { runNudgeChecks } from "@/lib/provisioning";

export const runtime = "nodejs";

/**
 * POST /api/admin/workspaces/nudge
 * Run stale-task and stale-provisioning checks for the current org.
 * admin+ only.
 */
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        assertRole(session.role, "admin");
    } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await runNudgeChecks(session.orgId);
    return NextResponse.json({ success: true, ...result });
}

/**
 * GET /api/admin/workspaces
 * List all workspaces for the current org.
 */
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspaces = await (prisma as any).clientWorkspace.findMany({
        where: { organizationId: session.orgId },
        include: {
            tasks: { select: { status: true } },
            checklist: { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    const enriched = workspaces.map((ws: any) => ({
        ...ws,
        taskCounts: {
            total: ws.tasks.length,
            done: ws.tasks.filter((t: any) => t.status === "done").length,
            blocked: ws.tasks.filter((t: any) => t.status === "blocked").length,
        },
        checklistCounts: {
            total: ws.checklist.length,
            verified: ws.checklist.filter((c: any) => c.status === "verified").length,
        },
    }));

    return NextResponse.json({ workspaces: enriched });
}
