/**
 * app/api/org/[slug]/builder/run/[id]/route.ts
 * V25: PATCH — status transitions for a BuildRun.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkBuilderAccess, isValidTransition } from "@/lib/builder/builder-guard";
import { logger } from "@/lib/logger";

export async function PATCH(
    req: NextRequest,
    { params }: { params: { slug: string; id: string } },
) {
    const { slug, id } = params;
    const role = req.headers.get("x-builder-role") ?? "admin";
    const gate = await checkBuilderAccess(slug, role);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 });

    let body: { status?: string; outputJson?: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { prisma } = await import("@/lib/prisma");
    const run = await (prisma as any).buildRun.findFirst({ where: { id, orgId: gate.orgId } }).catch(() => null);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    if (body.status) {
        if (!isValidTransition(run.status, body.status)) {
            return NextResponse.json(
                { error: `Invalid transition: ${run.status} → ${body.status}` },
                { status: 422 },
            );
        }
    }

    const updated = await (prisma as any).buildRun.update({
        where: { id },
        data: {
            ...(body.status ? { status: body.status } : {}),
            ...(body.outputJson ? { outputJson: body.outputJson } : {}),
            updatedAt: new Date(),
        },
    });

    logger.info("[Builder] Run status updated", { id, from: run.status, to: body.status });
    return NextResponse.json({ ok: true, run: updated });
}

export async function GET(
    req: NextRequest,
    { params }: { params: { slug: string; id: string } },
) {
    const { slug, id } = params;
    const role = req.headers.get("x-builder-role") ?? "admin";
    const gate = await checkBuilderAccess(slug, role);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 });

    const { prisma } = await import("@/lib/prisma");
    const run = await (prisma as any).buildRun.findFirst({
        where: { id, orgId: gate.orgId },
        include: { artifacts: true },
    }).catch(() => null);
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, run });
}
