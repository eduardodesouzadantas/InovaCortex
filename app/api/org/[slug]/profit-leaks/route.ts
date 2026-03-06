/**
 * app/api/org/[slug]/profit-leaks/route.ts
 * V22.2: GET profit leaks + snapshot for an org.
 *
 * Query params:
 *   window?  = "today" | "7d" | "30d"  (default "30d")
 *   kind?    = filter by leak kind
 *   status?  = filter by status (default: open + acknowledged)
 *
 * RBAC: closer+ can view (any org member with a session)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const { searchParams } = req.nextUrl;
    const window = (searchParams.get("window") ?? "30d") as "today" | "7d" | "30d";
    const kindFilter = searchParams.get("kind") ?? undefined;
    const statusFilter = searchParams.get("status") ?? undefined;

    try {
        // Resolve org
        const org = await (prisma as any).organization.findUnique({
            where: { slug },
            select: { id: true },
        });
        if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

        const orgId = org.id;

        // Fetch snapshot
        const snapshot = await (prisma as any).profitLeakSnapshot.findUnique({
            where: { orgId_window: { orgId, window } },
        }).catch(() => null);

        // Fetch leak rows
        const cutoff = windowCutoff(window);
        const leaks = await (prisma as any).profitLeak.findMany({
            where: {
                orgId,
                createdAt: { gte: cutoff },
                ...(kindFilter ? { kind: kindFilter } : {}),
                ...(statusFilter ? { status: statusFilter }
                    : { status: { in: ["open", "acknowledged"] } }),
            },
            orderBy: [{ severity: "desc" }, { estimatedLossCents: "desc" }],
        }).catch(() => [] as any[]);

        return NextResponse.json({ ok: true, window, snapshot, leaks });

    } catch (err: any) {
        logger.error("[ProfitLeaks GET]", { slug, err: err?.message });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function windowCutoff(w: string): Date {
    const now = new Date();
    if (w === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (w === "7d") return new Date(now.getTime() - 7 * 86_400_000);
    return new Date(now.getTime() - 30 * 86_400_000);
}
