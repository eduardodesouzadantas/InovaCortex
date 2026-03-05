
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { logSystemEvent } from "@/lib/system-events";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ slug: string, workspaceId: string }> }
) {
    const { slug, workspaceId } = await params;

    try {
        const ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "owner");

        const body = await req.json();
        const { active } = body;

        // Deactivate Client
        if (active === false) {
            const updated = await (prisma as any).clientWorkspace.update({
                where: { id: workspaceId, organizationId: ctx.orgId },
                data: {
                    status: "disabled",
                    workspacePublicToken: crypto.randomUUID() // Revoke access
                }
            });

            await logSystemEvent({
                organizationId: ctx.orgId,
                type: "client_disabled",
                entityType: "client_workspace",
                entityId: workspaceId,
                payload: { updatedBy: ctx.userId }
            });

            return NextResponse.json({ success: true, status: "disabled" });
        }

        // Reactivate Client
        if (active === true) {
            const updated = await (prisma as any).clientWorkspace.update({
                where: { id: workspaceId, organizationId: ctx.orgId },
                data: {
                    status: "active"
                }
            });
            return NextResponse.json({ success: true, status: "active" });
        }

        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 403 });
    }
}
