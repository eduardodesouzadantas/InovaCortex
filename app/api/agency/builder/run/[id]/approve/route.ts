/**
 * app/api/agency/builder/run/[id]/approve/route.ts
 * V26: Agency Builder canonical approve endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAgencyOrgSlug } from "@/lib/auth/session";
import { checkBuilderAccess, isValidTransition } from "@/lib/builder/builder-guard";
import { logBuilderAudit } from "@/lib/builder/builder-orchestrator";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const slug = getAgencyOrgSlug();
    const guard = await checkBuilderAccess(slug, req);
    if (!guard.allowed) {
        return NextResponse.json({ error: guard.reason }, { status: guard.status });
    }

    const { prisma } = await import("@/lib/prisma");
    const run = await (prisma as any).buildRun.findUnique({ where: { id } });
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    if (run.orgId !== guard.orgId) {
        return NextResponse.json({ error: "Org mismatch" }, { status: 403 });
    }

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

    await logBuilderAudit(guard.orgId, id, "builderApproved", { approvedBy: "agency_session", slug });

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
                    approvalRequired: true,
                },
            });
        } catch (err: any) {
            console.error("[builder] Failed to enqueue builder_execute", err?.message);
        }
    }

    return NextResponse.json({ ok: true, status: "approved" });
}
