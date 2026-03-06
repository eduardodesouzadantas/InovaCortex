/**
 * app/api/org/[slug]/builder/run/route.ts
 * V25: POST — Create a new BuildRun.
 *
 * Body: { mode: BuildMode; inputJson: string; targetOrgSlug?: string; targetWorkspaceId?: string }
 * RBAC: owner/admin + builder gate
 */

import { NextRequest, NextResponse } from "next/server";
import { checkBuilderAccess, ALL_BUILD_MODES } from "@/lib/builder/builder-guard";
import { logger } from "@/lib/logger";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;

    // For now accept admin token as auth (replace with session in production)
    const role = req.headers.get("x-builder-role") ?? "admin";
    const gate = await checkBuilderAccess(slug, role);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 });

    let body: { mode?: string; inputJson?: string; targetOrgSlug?: string; targetWorkspaceId?: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    if (!body.mode || !ALL_BUILD_MODES.includes(body.mode as any)) {
        return NextResponse.json({ error: `mode must be one of: ${ALL_BUILD_MODES.join(", ")}` }, { status: 400 });
    }
    if (!body.inputJson) return NextResponse.json({ error: "inputJson required" }, { status: 400 });

    const { prisma } = await import("@/lib/prisma");

    try {
        const run = await (prisma as any).buildRun.create({
            data: {
                orgId: gate.orgId,
                mode: body.mode,
                status: "draft",
                inputJson: body.inputJson,
                targetOrgSlug: body.targetOrgSlug ?? null,
                targetWorkspaceId: body.targetWorkspaceId ?? null,
            },
        });
        logger.info("[Builder] RunCreated", { runId: run.id, mode: run.mode });
        return NextResponse.json({ ok: true, run }, { status: 201 });
    } catch (err: any) {
        logger.error("[Builder] RunCreate failed", { err: err?.message });
        return NextResponse.json({ error: "Failed to create run" }, { status: 500 });
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const role = req.headers.get("x-builder-role") ?? "admin";
    const gate = await checkBuilderAccess(slug, role);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 });

    const { prisma } = await import("@/lib/prisma");
    const runs = await (prisma as any).buildRun.findMany({
        where: { orgId: gate.orgId },
        include: { artifacts: { select: { id: true, type: true, version: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
    }).catch(() => []);

    return NextResponse.json({ ok: true, runs });
}
