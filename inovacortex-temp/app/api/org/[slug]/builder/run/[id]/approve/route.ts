/**
 * app/api/org/[slug]/builder/run/[id]/approve/route.ts
 * V25.3: POST — approve a BuildRun (transitions review → approved)
 *
 * Security: org gating enforced at guard + service layer.
 * Audit: builderApproved event written.
 */

import { NextResponse } from "next/server";
import { checkBuilderAccess, isValidTransition } from "@/lib/builder/builder-guard";
import { logBuilderAudit } from "@/lib/builder/builder-orchestrator";

export async function POST(
    _req: Request,
    { params }: { params: { slug: string; id: string } },
) {
    const { slug, id } = params;
    const role = _req.headers.get("x-builder-role") ?? "";

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

    // ── Gate 3: approvalRequired must remain true (cannot bypass gate) ────────
    // Approve is always a human action, so we just validate state machine.
    if (!isValidTransition(run.status, "approved")) {
        return NextResponse.json(
            { error: `Cannot approve run in status "${run.status}"` },
            { status: 422 },
        );
    }

    await (prisma as any).buildRun.update({
        where: { id },
        data: { status: "approved", updatedAt: new Date() },
    });

    await logBuilderAudit(guard.orgId, id, "builderApproved", { approvedBy: role, slug });

    // If AI_AUTOPILOT_BUILDER is enabled, enqueue builder_execute into ActionQueue
    if (process.env.AI_AUTOPILOT_BUILDER === "true") {
        try {
            await (prisma as any).actionQueue.create({
                data: {
                    organizationId: guard.orgId,
                    type: "builder_execute",
                    payloadJson: JSON.stringify({ buildRunId: id, orgSlug: slug }),
                    priority: "high",
                    relatedEntityType: "build_run",
                    relatedEntityId: id,
                    status: "pending",
                    approvalRequired: true,   // always true — safety net
                },
            });
        } catch (err: any) {
            // Non-fatal — log and continue (manual trigger still works)
            console.error("[builder] Failed to enqueue builder_execute", err?.message);
        }
    }

    return NextResponse.json({ ok: true, status: "approved" });
}
