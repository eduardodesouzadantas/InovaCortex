/**
 * app/api/org/[slug]/outbound/sequences/[seqId]/run/route.ts
 * V21: POST — Force run an outbound sequence step now.
 *
 * app/api/org/[slug]/outbound/sequences/[seqId]/route.ts
 * V21: PATCH — Pause or resume sequence.
 */

// This file handles: /sequences/[seqId]/run
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sendNextOutboundStep } from "@/lib/outbound/outbound-engine";

interface Params { params: { slug: string; seqId: string } }

export async function POST(req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions as any).catch(() => null);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { prisma } = await import("@/lib/prisma");
    const org = await (prisma as any).organization.findUnique({
        where: { slug: params.slug }, select: { id: true },
    }).catch(() => null);
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    // Force nextAt to now so sendNextOutboundStep runs
    await (prisma as any).outboundSequence.updateMany({
        where: { id: params.seqId, orgId: org.id },
        data: { nextAt: new Date() },
    }).catch(() => null);

    try {
        const result = await sendNextOutboundStep(org.id, params.seqId);
        return NextResponse.json({ message: result.sent ? "Passo executado" : result.reason, ...result });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
    }
}
