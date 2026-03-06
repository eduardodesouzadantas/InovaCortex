/**
 * app/api/org/[slug]/outbound/sequences/[seqId]/route.ts
 * V21: PATCH — Pause or resume an outbound sequence.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";

interface Params { params: Promise<{ slug: string; seqId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
    const { slug, seqId } = await params;
    let ctx;
    try { ctx = await requireOrgContext(slug); }
    catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

    let body: { action: "pause" | "resume" };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { prisma } = await import("@/lib/prisma");

    const paused = body.action === "pause";
    await (prisma as any).outboundSequence.updateMany({
        where: { id: seqId, orgId: ctx.orgId },
        data: { paused },
    });

    return NextResponse.json({ message: paused ? "Sequência pausada" : "Sequência retomada", paused });
}
