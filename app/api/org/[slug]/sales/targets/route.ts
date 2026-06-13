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
import { writeAuditEvent } from "@/lib/audit";

type SalesTargetBody = {
    month?: string;
    salesRepId?: string;
    targetCents?: number;
};

async function POSTHandler(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const p = await params;
        const { orgId, role } = await requireOrgContext(p.slug);
        assertTenantRole(role, "admin");

        const body = await req.json().catch(() => null) as SalesTargetBody | null;
        const salesRepId = body?.salesRepId;
        const month = body?.month;
        const targetCents = body?.targetCents;
        if (!salesRepId || typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month) || typeof targetCents !== "number") {
            return invalidTenantInputResponse("Invalid payload");
        }

        const rep = await prisma.salesRep.findFirst({
            where: { id: salesRepId, organizationId: orgId },
            select: { id: true }
        });
        if (!rep) return tenantNotFoundResponse("Rep not found");

        const target = await prisma.salesTarget.upsert({
            where: { salesRepId_month: { salesRepId, month } },
            update: { targetCents },
            create: { salesRepId, month, targetCents }
        });

        await writeAuditEvent({
            organizationId: orgId,
            action: "target_set",
            details: { salesRepId, month, targetCents },
            strict: true,
            context: { salesRepId, month },
        });

        return NextResponse.json({ target }, { status: 200 });
    } catch (e: unknown) {
        return resolveTenantRouteError(e, "Failed to update sales target");
    }
}

export const POST = withApiLogging("/api/org/[slug]/sales/targets", "POST", POSTHandler);
