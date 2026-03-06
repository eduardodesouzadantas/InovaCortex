import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
import { markGoLive } from "@/lib/provisioning";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** POST /api/admin/workspaces/[id]/golive */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        assertRole(session.role, "admin");
    } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: workspaceId } = await params;

    const workspace = await (prisma as any).clientWorkspace.findFirst({
        where: { id: workspaceId, organizationId: session.orgId }
    });

    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await markGoLive(workspaceId, workspace.assessmentId, session.orgId);

    return NextResponse.json({ success: true, status: "active" });
}
