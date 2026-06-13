import { withApiLogging } from "@/lib/logger";

import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
} from "@/lib/auth/tenant-route";
import { prisma } from "@/lib/prisma";

type TeamSalesRepBody = {
    email?: string | null;
    name?: string;
    phone?: string | null;
    role?: string;
};

async function POSTHandler(
    req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    try {
        const ctx = await requireOrgContext(slug);
        assertTenantRole(ctx.role, "admin");

        const body = await req.json().catch(() => null) as TeamSalesRepBody | null;
        if (!body) {
            return invalidTenantInputResponse("Invalid JSON");
        }
        const { name, email, phone, role } = body;

        if (!name || !name.trim()) return invalidTenantInputResponse("Name is required");

        const rep = await prisma.salesRep.create({
            data: {
                organizationId: ctx.orgId,
                name: name.trim(),
                email: typeof email === "string" ? email : null,
                phone: typeof phone === "string" ? phone : null,
                role: typeof role === "string" && role.trim() ? role : "sales",
                active: true
            }
        });

        return NextResponse.json(rep);
    } catch (err) {
        return resolveTenantRouteError(err, "Failed to create team sales rep");
    }
}

async function GETHandler(
    req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    try {
        const ctx = await requireOrgContext(slug);
        assertTenantRole(ctx.role, "viewer");

        const reps = await prisma.salesRep.findMany({
            where: { organizationId: ctx.orgId },
            orderBy: { name: "asc" }
        });

        return NextResponse.json(reps);
    } catch (err) {
        return resolveTenantRouteError(err, "Failed to load team sales reps");
    }
}

export const POST = withApiLogging("/api/org/[slug]/team/salesreps", "POST", POSTHandler);
export const GET = withApiLogging("/api/org/[slug]/team/salesreps", "GET", GETHandler);
