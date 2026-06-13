import { withApiLogging } from "@/lib/logger";

import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import { prisma } from "@/lib/prisma";
import { logSystemEvent } from "@/lib/system-events";

async function PATCHHandler(
    req: Request,
    { params }: { params: Promise<{ slug: string, workspaceId: string }> }
) {
    const { slug, workspaceId } = await params;

    try {
        const ctx = await requireOrgContext(slug);
        assertTenantRole(ctx.role, "owner");

        const body = await req.json();
        const { active } = body;
        const workspace = await prisma.clientWorkspace.findFirst({
            where: { id: workspaceId, organizationId: ctx.orgId },
            select: { id: true },
        });
        if (!workspace) {
            return tenantNotFoundResponse("Client workspace not found");
        }

        // Deactivate Client
        if (active === false) {
            await prisma.clientWorkspace.update({
                where: { id: workspaceId },
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
            await prisma.clientWorkspace.update({
                where: { id: workspaceId },
                data: {
                    status: "active"
                }
            });
            return NextResponse.json({ success: true, status: "active" });
        }

        return invalidTenantInputResponse("Invalid request");
    } catch (err) {
        return resolveTenantRouteError(err, "Failed to update client workspace");
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/admin/clients/[workspaceId]", "PATCH", PATCHHandler);
