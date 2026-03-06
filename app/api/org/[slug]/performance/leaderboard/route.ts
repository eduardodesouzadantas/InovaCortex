
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { buildLeaderboards, computeOrgKPIs, WindowKey } from "@/lib/performance/stats-engine";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const window = (searchParams.get("window") as WindowKey) || "7d";

    try {
        const ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "admin");

        const leaderboard = await buildLeaderboards(ctx.orgId, window);
        return NextResponse.json(leaderboard);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: err.message === "FORBIDDEN" ? 403 : 401 });
    }
}
