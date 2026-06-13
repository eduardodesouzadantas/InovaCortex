import { withApiLogging } from "@/lib/logger";

import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
} from "@/lib/auth/tenant-route";
import { buildLeaderboards, WindowKey } from "@/lib/performance/stats-engine";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";

const WINDOW_OPTIONS: WindowKey[] = ["7d", "30d", "90d"];

async function GETHandler(
    req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const windowParam = searchParams.get("window");
    const window = WINDOW_OPTIONS.includes(windowParam as WindowKey) ? windowParam as WindowKey : "7d";
    const pagination = parsePagination(searchParams, { defaultLimit: 25, maxLimit: 100 });

    try {
        if (windowParam && !WINDOW_OPTIONS.includes(windowParam as WindowKey)) {
            return invalidTenantInputResponse("window must be one of: 7d, 30d, 90d");
        }
        const ctx = await requireOrgContext(slug);
        assertTenantRole(ctx.role, "admin");

        const leaderboard = await buildLeaderboards(ctx.orgId, window);
        return NextResponse.json({
            leaderboard: leaderboard.slice(pagination.skip, pagination.skip + pagination.limit),
            pagination: buildPaginationMeta({ ...pagination, total: leaderboard.length }),
        });
    } catch (err) {
        return resolveTenantRouteError(err, "Failed to load performance leaderboard");
    }
}

export const GET = withApiLogging("/api/org/[slug]/performance/leaderboard", "GET", GETHandler);
