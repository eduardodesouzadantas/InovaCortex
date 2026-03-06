import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

/** PATCH /api/admin/workspaces/[id]/checklist/[itemId] */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> }
) {
    const session = await getSession();
    if (!session || !["owner", "admin"].includes(session.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId, itemId } = await params;
    const { status, notes } = await request.json();

    const valid = ["pending", "provided", "verified"];
    if (!valid.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const item = await (prisma as any).integrationChecklistItem.findFirst({
        where: { id: itemId, workspaceId },
        include: { workspace: { select: { organizationId: true } } },
    });

    if (!item || item.workspace.organizationId !== session.orgId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await (prisma as any).integrationChecklistItem.update({
        where: { id: itemId },
        data: { status, notes: notes ?? item.notes },
    });

    return NextResponse.json({ success: true, itemId, status });
}
