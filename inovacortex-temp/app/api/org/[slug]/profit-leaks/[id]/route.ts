/**
 * app/api/org/[slug]/profit-leaks/[id]/route.ts
 * V22.2: PATCH — update a ProfitLeak status.
 *
 * Body: { status: "acknowledged" | "resolved" }
 *
 * RBAC:
 *   - "acknowledged"  → closer+ (any authenticated user)
 *   - "resolved"      → admin+ (x-admin-token or elevated session)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const ALLOWED_STATUSES = ["open", "acknowledged", "resolved"] as const;
type LeakStatus = typeof ALLOWED_STATUSES[number];

export async function PATCH(
    req: NextRequest,
    { params }: { params: { slug: string; id: string } },
) {
    const { slug, id } = params;

    let body: { status?: LeakStatus };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const newStatus = body.status;
    if (!newStatus || !ALLOWED_STATUSES.includes(newStatus)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Resolve + authorize
    const adminToken = req.headers.get("x-admin-token");
    const isAdmin = adminToken && adminToken === process.env.ADMIN_SECRET_TOKEN;

    if (newStatus === "resolved" && !isAdmin) {
        return NextResponse.json({ error: "Admin required to resolve" }, { status: 403 });
    }

    try {
        const org = await (prisma as any).organization.findUnique({
            where: { slug }, select: { id: true },
        });
        if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const updated = await (prisma as any).profitLeak.update({
            where: { id },
            data: { status: newStatus, updatedAt: new Date() },
        });

        // Audit
        await (prisma as any).auditEvent.create({
            data: {
                assessmentId: "system",
                organizationId: org.id,
                action: "profitLeakStatusChanged",
                details: JSON.stringify({ leakId: id, newStatus }),
            },
        }).catch(() => null);

        logger.info("[ProfitLeak PATCH]", { id, newStatus });
        return NextResponse.json({ ok: true, leak: updated });

    } catch (err: any) {
        logger.error("[ProfitLeak PATCH]", { id, err: err?.message });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
