import { withApiLogging } from "@/lib/logger";

import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
} from "@/lib/auth/tenant-route";
import { computeOrgKPIs, WindowKey } from "@/lib/performance/stats-engine";

const WINDOW_OPTIONS: WindowKey[] = ["7d", "30d", "90d"];

async function GETHandler(
    req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const windowParam = searchParams.get("window");
    const window = WINDOW_OPTIONS.includes(windowParam as WindowKey) ? windowParam as WindowKey : "7d";

    try {
        if (windowParam && !WINDOW_OPTIONS.includes(windowParam as WindowKey)) {
            return invalidTenantInputResponse("window must be one of: 7d, 30d, 90d");
        }
        const ctx = await requireOrgContext(slug);
        assertTenantRole(ctx.role, "admin");

        const overview = await computeOrgKPIs(ctx.orgId, window);
        return NextResponse.json(overview);
    } catch (err) {
        return resolveTenantRouteError(err, "Failed to load performance overview");
    }
}

export const GET = withApiLogging("/api/org/[slug]/performance/overview", "GET", GETHandler);
