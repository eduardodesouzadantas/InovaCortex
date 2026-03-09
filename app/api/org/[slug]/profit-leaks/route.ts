/**
 * app/api/org/[slug]/profit-leaks/route.ts
 * V22.3: GET profit leaks + snapshot for an org.
 *
 * Query params:
 * - window: "today" | "7d" | "30d" (default "30d")
 * - kind: filter by leak kind
 * - status: filter by status (default open + acknowledged)
 *
 * Auth/RBAC: tenant session + closer+
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { requireOrgContext } from "@/lib/auth/org-context";
import { hasRole } from "@/lib/auth/rbac";

function mapOrgContextError(err: unknown): { status: 401 | 403 | 404; error: string } {
    if (err instanceof Error) {
        if (err.message === "UNAUTHENTICATED") return { status: 401, error: "Unauthorized" };
        if (err.message === "ORG_NOT_FOUND") return { status: 404, error: "Org not found" };
    }
    return { status: 403, error: "Forbidden" };
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const { searchParams } = req.nextUrl;
    const window = (searchParams.get("window") ?? "30d") as "today" | "7d" | "30d";
    const kindFilter = searchParams.get("kind") ?? undefined;
    const statusFilter = searchParams.get("status") ?? undefined;

    let orgId: string;
    try {
        const orgCtx = await requireOrgContext(slug);
        if (!hasRole(orgCtx.role, "closer")) {
            return NextResponse.json({ error: "Forbidden role" }, { status: 403 });
        }
        orgId = orgCtx.orgId;
    } catch (err) {
        const mapped = mapOrgContextError(err);
        return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    try {
        const snapshot = await (prisma as any).profitLeakSnapshot.findUnique({
            where: { orgId_window: { orgId, window } },
        }).catch(() => null);

        const cutoff = windowCutoff(window);
        const leaks = await (prisma as any).profitLeak.findMany({
            where: {
                orgId,
                createdAt: { gte: cutoff },
                ...(kindFilter ? { kind: kindFilter } : {}),
                ...(statusFilter ? { status: statusFilter } : { status: { in: ["open", "acknowledged"] } }),
            },
            orderBy: [{ severity: "desc" }, { estimatedLossCents: "desc" }],
        }).catch(() => [] as any[]);

        return NextResponse.json({ ok: true, window, snapshot, leaks });
    } catch (err: any) {
        logger.error("[ProfitLeaks GET]", { slug, err: err?.message });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

function windowCutoff(w: string): Date {
    const now = new Date();
    if (w === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (w === "7d") return new Date(now.getTime() - 7 * 86_400_000);
    return new Date(now.getTime() - 30 * 86_400_000);
}
