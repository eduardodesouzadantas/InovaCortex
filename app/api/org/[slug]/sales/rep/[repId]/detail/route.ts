import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { resolveTenantRouteError, tenantNotFoundResponse } from "@/lib/auth/tenant-route";
import { getRepStats } from "@/lib/sales/stats-engine";
import { getRepAssignments } from "@/lib/sales/assignment-engine";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";

async function GETHandler(req: Request, { params }: { params: Promise<{ slug: string; repId: string }> }) {
    try {
        const p = await params;
        const { orgId } = await requireOrgContext(p.slug);
        const pagination = parsePagination(new URL(req.url).searchParams, { defaultLimit: 25, maxLimit: 100 });

        const rep = await prisma.salesRep.findFirst({
            where: { id: p.repId, organizationId: orgId },
            select: { id: true }
        });
        if (!rep) return tenantNotFoundResponse("Rep not found");

        const month = new URL(req.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);
        const [stats, assignments] = await Promise.all([
            getRepStats(p.repId, month),
            getRepAssignments(orgId, p.repId)
        ]);

        if (!stats) return tenantNotFoundResponse("Rep not found");
        return NextResponse.json({
            stats,
            assignments: assignments.slice(pagination.skip, pagination.skip + pagination.limit),
            pagination: buildPaginationMeta({ ...pagination, total: assignments.length }),
        });
    } catch (e: unknown) {
        return resolveTenantRouteError(e, "Failed to load rep detail");
    }
}

export const GET = withApiLogging("/api/org/[slug]/sales/rep/[repId]/detail", "GET", GETHandler);
