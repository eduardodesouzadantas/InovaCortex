import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";

type SalesRepUpdateBody = {
    active?: boolean;
    email?: string | null;
    name?: string;
    phone?: string | null;
    role?: string;
};

async function PATCHHandler(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
    try {
        const p = await params;
        const { orgId, role } = await requireOrgContext(p.slug);
        assertTenantRole(role, "admin");

        const repId = p.id;
        const repInOrg = await prisma.salesRep.findFirst({
            where: { id: repId, organizationId: orgId },
            select: { id: true }
        });
        if (!repInOrg) return tenantNotFoundResponse("Rep not found");

        const body = await req.json().catch(() => null) as SalesRepUpdateBody | null;
        if (!body) {
            return invalidTenantInputResponse("Invalid JSON");
        }

        const rep = await prisma.salesRep.update({
            where: { id: repId },
            data: {
                ...(typeof body.name === "string" && body.name.trim() ? { name: body.name.trim() } : {}),
                ...(typeof body.phone === "string" || body.phone === null ? { phone: body.phone ?? null } : {}),
                ...(typeof body.email === "string" || body.email === null ? { email: body.email ?? null } : {}),
                ...(typeof body.role === "string" && body.role.trim() ? { role: body.role } : {}),
                ...(typeof body.active === "boolean" ? { active: body.active } : {}),
            }
        });

        return NextResponse.json({ rep });
    } catch (e: unknown) {
        return resolveTenantRouteError(e, "Failed to update sales rep");
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/sales/reps/[id]", "PATCH", PATCHHandler);
