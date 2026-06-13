import { NextRequest, NextResponse } from "next/server";
import { getAgencyOrgSlug } from "@/lib/auth/session";
import { checkBuilderAccess, isValidTransition } from "@/lib/builder/builder-guard";
import { logBuilderAudit } from "@/lib/builder/builder-orchestrator";
import { withApiLogging } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

async function POSTHandler(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const slug = getAgencyOrgSlug();
    const guard = await checkBuilderAccess(slug, req);
    if (!guard.allowed) {
        return NextResponse.json({ error: guard.reason }, { status: guard.status });
    }

    const run = await prisma.buildRun.findUnique({
        where: { id },
        select: { id: true, orgId: true, status: true },
    });

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

    await prisma.buildRun.update({
        where: { id },
        data: { status: "approved", updatedAt: new Date() },
    });

    await logBuilderAudit(guard.orgId, id, "builderApproved", {
        approvedBy: "agency_session",
        slug,
    });

    if (process.env.AI_AUTOPILOT_BUILDER === "true") {
        try {
            await prisma.actionQueue.create({
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
        } catch (error: unknown) {
            console.error(
                "[builder] Failed to enqueue builder_execute",
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    return NextResponse.json({ ok: true, status: "approved" });
}

export const POST = withApiLogging("/api/agency/builder/run/[id]/approve", "POST", POSTHandler);
