import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAgencyOrgSlug } from "@/lib/auth/session";
import { checkBuilderAccess, isValidTransition } from "@/lib/builder/builder-guard";
import { logger, withApiLogging } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type BuilderRunDetail = Prisma.BuildRunGetPayload<{
    include: {
        artifacts: true;
    };
}>;

type UpdateRunBody = {
    status?: string;
    outputJson?: string;
};

async function PATCHHandler(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const slug = getAgencyOrgSlug();
    const gate = await checkBuilderAccess(slug, req);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: gate.status });

    let body: UpdateRunBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const run = await prisma.buildRun.findFirst({
        where: { id, orgId: gate.orgId },
        select: { id: true, status: true },
    }).catch(() => null);

    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    if (body.status && !isValidTransition(run.status, body.status)) {
        return NextResponse.json(
            { error: `Invalid transition: ${run.status} -> ${body.status}` },
            { status: 422 },
        );
    }

    const updated = await prisma.buildRun.update({
        where: { id },
        data: {
            ...(body.status ? { status: body.status } : {}),
            ...(body.outputJson ? { outputJson: body.outputJson } : {}),
            updatedAt: new Date(),
        },
    });

    logger.info("[Builder][Agency] Run status updated", { id, from: run.status, to: body.status });
    return NextResponse.json({ ok: true, run: updated });
}

async function GETHandler(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const slug = getAgencyOrgSlug();
    const gate = await checkBuilderAccess(slug, req);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: gate.status });

    const run = await prisma.buildRun.findFirst({
        where: { id, orgId: gate.orgId },
        include: { artifacts: true },
    }).catch(() => null as BuilderRunDetail | null);

    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, run });
}

export const PATCH = withApiLogging("/api/agency/builder/run/[id]", "PATCH", PATCHHandler);
export const GET = withApiLogging("/api/agency/builder/run/[id]", "GET", GETHandler);
