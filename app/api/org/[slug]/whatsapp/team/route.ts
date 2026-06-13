import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { resolveTenantRouteError } from "@/lib/auth/tenant-route";
import { calculateTeamPerformance } from "@/lib/whatsapp/engines/metrics-engine";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";

async function GETHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { orgId } = await requireOrgContext((await params).slug);
        const pagination = parsePagination(new URL(request.url).searchParams, { defaultLimit: 25, maxLimit: 100 });

        const performance = await calculateTeamPerformance(orgId);
        const team = performance.slice(pagination.skip, pagination.skip + pagination.limit);

        return NextResponse.json({
            team,
            pagination: buildPaginationMeta({ ...pagination, total: performance.length }),
        }, { status: 200 });
    } catch (e) {
        return resolveTenantRouteError(e, "Failed to load WhatsApp team performance");
    }
}

export const GET = withApiLogging("/api/org/[slug]/whatsapp/team", "GET", GETHandler);
