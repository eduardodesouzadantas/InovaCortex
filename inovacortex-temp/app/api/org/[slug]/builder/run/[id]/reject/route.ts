/**
 * app/api/org/[slug]/builder/run/[id]/reject/route.ts
 * V25.3: POST — reject a BuildRun (transitions review → draft for retry)
 *
 * Security: same triple gate as approve route.
 * Audit: builderRejected event written.
 */

import { NextResponse } from "next/server";
import { checkBuilderAccess, isValidTransition } from "@/lib/builder/builder-guard";
import { logBuilderAudit } from "@/lib/builder/builder-orchestrator";

export async function POST(
    req: Request,
    { params }: { params: { slug: string; id: string } },
) {
    const { slug, id } = params;
    const role = req.headers.get("x-builder-role") ?? "";

    let reason = "";
    try {
        const body = await req.json().catch(() => ({}));
        reason = body?.reason ?? "";
    } catch { }

    // ── Gate 1: org + role ────────────────────────────────────────────────────
    const guard = await checkBuilderAccess(slug, role);
    if (!guard.allowed) {
        return NextResponse.json({ error: guard.reason }, { status: 403 });
    }

    const { prisma } = await import("@/lib/prisma");

    // ── Gate 2: run ownership ─────────────────────────────────────────────────
    const run = await (prisma as any).buildRun.findUnique({ where: { id } });
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    if (run.orgId !== guard.orgId) {
        return NextResponse.json({ error: "Org mismatch" }, { status: 403 });
    }

    // ── Gate 3: state machine — reject is only valid from "review" ────────────
    // Rejection resets to "draft" so it can be retried
    if (!isValidTransition(run.status, "draft")) {
        return NextResponse.json(
            { error: `Cannot reject run in status "${run.status}"` },
            { status: 422 },
        );
    }

    await (prisma as any).buildRun.update({
        where: { id },
        data: {
            status: "draft",
            outputJson: JSON.stringify({ rejectedAt: new Date().toISOString(), reason }),
            updatedAt: new Date(),
        },
    });

    await logBuilderAudit(guard.orgId, id, "builderRejected", { rejectedBy: role, reason, slug });

    return NextResponse.json({ ok: true, status: "draft", reason });
}
