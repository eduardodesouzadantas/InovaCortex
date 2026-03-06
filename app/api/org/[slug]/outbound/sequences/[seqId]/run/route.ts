/**
 * app/api/org/[slug]/outbound/sequences/[seqId]/run/route.ts
 * V21: POST — Force run an outbound sequence step now.
 *
 * app/api/org/[slug]/outbound/sequences/[seqId]/route.ts
 * V21: PATCH — Pause or resume sequence.
 */

// This file handles: /sequences/[seqId]/run
import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { sendNextOutboundStep } from "@/lib/outbound/outbound-engine";

interface Params { params: Promise<{ slug: string; seqId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
    const { slug, seqId } = await params;
    let ctx;
    try { ctx = await requireOrgContext(slug); }
    catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

    const { prisma } = await import("@/lib/prisma");

    // Force nextAt to now so sendNextOutboundStep runs

    // Force nextAt to now so sendNextOutboundStep runs
    await (prisma as any).outboundSequence.updateMany({
        where: { id: seqId, orgId: ctx.orgId },
        data: { nextAt: new Date() },
    }).catch(() => null);

    try {
        const result = await sendNextOutboundStep(ctx.orgId, seqId);
        return NextResponse.json({ message: result.sent ? "Passo executado" : result.reason, ...result });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
    }
}
