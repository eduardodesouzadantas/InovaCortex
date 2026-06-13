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

type TeamSalesRepUpdateBody = {
    active?: boolean;
    email?: string | null;
    name?: string;
    phone?: string | null;
    role?: string;
};

async function PATCHHandler(
    req: Request,
    { params }: { params: Promise<{ slug: string, id: string }> }
) {
    const { slug, id } = await params;

    try {
        const ctx = await requireOrgContext(slug);
        assertTenantRole(ctx.role, "admin");

        const body = await req.json().catch(() => null) as TeamSalesRepUpdateBody | null;
        if (!body) {
            return invalidTenantInputResponse("Invalid JSON");
        }
        const { name, email, phone, role, active } = body;

        const rep = await prisma.salesRep.findFirst({
            where: { id, organizationId: ctx.orgId },
            select: { id: true },
        });
        if (!rep) {
            return tenantNotFoundResponse("Sales rep not found");
        }

        const updated = await prisma.salesRep.update({
            where: { id },
            data: {
                ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
                ...(typeof email === "string" || email === null ? { email: email ?? null } : {}),
                ...(typeof phone === "string" || phone === null ? { phone: phone ?? null } : {}),
                ...(typeof role === "string" && role.trim() ? { role } : {}),
                ...(typeof active === "boolean" && { active })
            }
        });

        return NextResponse.json(updated);
    } catch (err) {
        return resolveTenantRouteError(err, "Failed to update team sales rep");
    }
}

async function DELETEHandler(
    req: Request,
    { params }: { params: Promise<{ slug: string, id: string }> }
) {
    const { slug, id } = await params;

    try {
        const ctx = await requireOrgContext(slug);
        assertTenantRole(ctx.role, "owner");

        const rep = await prisma.salesRep.findFirst({
            where: { id, organizationId: ctx.orgId },
            select: { id: true },
        });
        if (!rep) {
            return tenantNotFoundResponse("Sales rep not found");
        }

        await prisma.salesRep.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        return resolveTenantRouteError(err, "Failed to delete team sales rep");
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/team/salesreps/[id]", "PATCH", PATCHHandler);
export const DELETE = withApiLogging("/api/org/[slug]/team/salesreps/[id]", "DELETE", DELETEHandler);
