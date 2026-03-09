/**
 * app/api/agency/builder/run/route.ts
 * V26: Agency Builder canonical endpoint for BuildRun list/create.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAgencyOrgSlug } from "@/lib/auth/session";
import { checkBuilderAccess, ALL_BUILD_MODES } from "@/lib/builder/builder-guard";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
    const slug = getAgencyOrgSlug();
    const gate = await checkBuilderAccess(slug, req);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: gate.status });

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
        logger.info("[Builder][Agency] RunCreated", { runId: run.id, mode: run.mode });
        return NextResponse.json({ ok: true, run }, { status: 201 });
    } catch (err: any) {
        logger.error("[Builder][Agency] RunCreate failed", { err: err?.message });
        return NextResponse.json({ error: "Failed to create run" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const slug = getAgencyOrgSlug();
    const gate = await checkBuilderAccess(slug, req);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: gate.status });

    const { prisma } = await import("@/lib/prisma");
    const runs = await (prisma as any).buildRun.findMany({
        where: { orgId: gate.orgId },
        include: { artifacts: { select: { id: true, type: true, version: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
    }).catch(() => []);

    return NextResponse.json({ ok: true, runs });
}
