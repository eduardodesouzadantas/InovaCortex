import { NextRequest, NextResponse } from "next/server";
import { getAgencyOrgSlug } from "@/lib/auth/session";
import { checkBuilderAccess, isValidTransition } from "@/lib/builder/builder-guard";
import { logBuilderAudit } from "@/lib/builder/builder-orchestrator";
import { withApiLogging } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type RejectRunBody = {
    reason?: string;
};

async function POSTHandler(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const slug = getAgencyOrgSlug();

    let reason = "";
    try {
        const body = await req.json().catch(() => ({} as RejectRunBody));
        reason = typeof body.reason === "string" ? body.reason : "";
    } catch {
        reason = "";
    }

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
    if (!isValidTransition(run.status, "draft")) {
        return NextResponse.json(
            { error: `Cannot reject run in status "${run.status}"` },
            { status: 422 },
        );
    }

    await prisma.buildRun.update({
        where: { id },
        data: {
            status: "draft",
            outputJson: JSON.stringify({ rejectedAt: new Date().toISOString(), reason }),
            updatedAt: new Date(),
        },
    });

    await logBuilderAudit(guard.orgId, id, "builderRejected", {
        rejectedBy: "agency_session",
        reason,
        slug,
    });

    return NextResponse.json({ ok: true, status: "draft", reason });
}

export const POST = withApiLogging("/api/agency/builder/run/[id]/reject", "POST", POSTHandler);
