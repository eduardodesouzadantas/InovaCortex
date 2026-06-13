import { withApiLogging } from "@/lib/logger";

import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
} from "@/lib/auth/tenant-route";
import { prisma } from "@/lib/prisma";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";

const WINDOW_OPTIONS = new Set(["7d", "30d", "90d"]);

async function GETHandler(
    req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const window = searchParams.get("window") || "30d";
    const pagination = parsePagination(searchParams, { defaultLimit: 14, maxLimit: 100 });

    try {
        if (!WINDOW_OPTIONS.has(window)) {
            return invalidTenantInputResponse("window must be one of: 7d, 30d, 90d");
        }
        const ctx = await requireOrgContext(slug);
        assertTenantRole(ctx.role, "admin");

        const [total, snapshots] = await prisma.$transaction([
            prisma.performanceSnapshot.count({
                where: { organizationId: ctx.orgId, window },
            }),
            prisma.performanceSnapshot.findMany({
                where: { organizationId: ctx.orgId, window },
                select: {
                    id: true,
                    organizationId: true,
                    salesRepId: true,
                    window: true,
                    statsJson: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                skip: pagination.skip,
                take: pagination.limit,
            }),
        ]);

        return NextResponse.json({
            snapshots,
            pagination: buildPaginationMeta({ ...pagination, total }),
        });
    } catch (err) {
        return resolveTenantRouteError(err, "Failed to load performance snapshots");
    }
}

export const GET = withApiLogging("/api/org/[slug]/performance/snapshots", "GET", GETHandler);
