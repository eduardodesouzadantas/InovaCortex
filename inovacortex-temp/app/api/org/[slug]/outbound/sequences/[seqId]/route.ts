/**
 * app/api/org/[slug]/outbound/sequences/[seqId]/route.ts
 * V21: PATCH — Pause or resume an outbound sequence.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface Params { params: { slug: string; seqId: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions as any).catch(() => null);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { action: "pause" | "resume" };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { prisma } = await import("@/lib/prisma");
    const org = await (prisma as any).organization.findUnique({
        where: { slug: params.slug }, select: { id: true },
    }).catch(() => null);
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    const paused = body.action === "pause";
    await (prisma as any).outboundSequence.updateMany({
        where: { id: params.seqId, orgId: org.id },
        data: { paused },
    });

    return NextResponse.json({ message: paused ? "Sequência pausada" : "Sequência retomada", paused });
}
