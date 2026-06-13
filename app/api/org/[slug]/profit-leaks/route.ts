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
import { logger, withApiLogging } from "@/lib/logger";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
} from "@/lib/auth/tenant-route";

async function GETHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const { searchParams } = req.nextUrl;
    const window = searchParams.get("window") ?? "30d";
    const kindFilter = searchParams.get("kind") ?? undefined;
    const statusFilter = searchParams.get("status") ?? undefined;

    try {
        if (window !== "today" && window !== "7d" && window !== "30d") {
            return invalidTenantInputResponse("window must be one of: today, 7d, 30d");
        }

        const orgCtx = await requireOrgContext(slug);
        assertTenantRole(orgCtx.role, "closer");

        const snapshot = await prisma.profitLeakSnapshot.findUnique({
            where: { orgId_window: { orgId: orgCtx.orgId, window } },
        });

        const cutoff = windowCutoff(window);
        const leaks = await prisma.profitLeak.findMany({
            where: {
                orgId: orgCtx.orgId,
                createdAt: { gte: cutoff },
                ...(kindFilter ? { kind: kindFilter } : {}),
                ...(statusFilter ? { status: statusFilter } : { status: { in: ["open", "acknowledged"] } }),
            },
            orderBy: [{ severity: "desc" }, { estimatedLossCents: "desc" }],
        });

        return NextResponse.json({ ok: true, window, snapshot, leaks });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("[ProfitLeaks GET]", { slug, err: message });
        return resolveTenantRouteError(err, "Failed to load profit leaks");
    }
}

function windowCutoff(w: string): Date {
    const now = new Date();
    if (w === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (w === "7d") return new Date(now.getTime() - 7 * 86_400_000);
    return new Date(now.getTime() - 30 * 86_400_000);
}

export const GET = withApiLogging("/api/org/[slug]/profit-leaks", "GET", GETHandler);
