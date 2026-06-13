import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/sales/stats-engine";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";

async function GETHandler(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) return orgContextErrorResponse(ctx);

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const pagination = parsePagination(searchParams, { defaultLimit: 25, maxLimit: 100 });

    const leaderboard = await getLeaderboard(ctx.orgId, month);
    return NextResponse.json({
        leaderboard: leaderboard.slice(pagination.skip, pagination.skip + pagination.limit),
        month,
        pagination: buildPaginationMeta({ ...pagination, total: leaderboard.length }),
    });
}

export const GET = withApiLogging("/api/org/[slug]/sales/leaderboard", "GET", GETHandler);
