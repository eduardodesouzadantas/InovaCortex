/**
 * app/api/agency/builder/run/[id]/reject/route.ts
 * V26: Agency Builder canonical reject endpoint.
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

    let reason = "";
    try {
        const body = await req.json().catch(() => ({}));
        reason = body?.reason ?? "";
    } catch { }

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

    await logBuilderAudit(guard.orgId, id, "builderRejected", { rejectedBy: "agency_session", reason, slug });

    return NextResponse.json({ ok: true, status: "draft", reason });
}
