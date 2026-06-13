import { withApiLogging } from "@/lib/logger";
/**
 * app/api/public/deal/[slug]/cta/route.ts
 * V21: Public endpoint — records DealSignal "meeting_scheduled" (CTA click).
 * No auth. Called from the Executive One-Pager page JS.
 */

import { NextRequest, NextResponse } from "next/server";

interface Params { params: Promise<{ slug: string }> }

async function POSTHandler(req: NextRequest, { params }: Params) {
    try {
        const { prisma } = await import("@/lib/prisma");

        const packet = await (prisma as any).dealPacket.findUnique({
            where: { execSlug: (await params).slug },
            select: { id: true, orgId: true, assessmentId: true },
        }).catch(() => null);

        if (!packet) return NextResponse.json({ ok: false }, { status: 404 });

        await (prisma as any).dealSignal.create({
            data: {
                orgId: packet.orgId,
                assessmentId: packet.assessmentId,
                dealPacketId: packet.id,
                type: "meeting_scheduled",
                metadataJson: JSON.stringify({ source: "cta_click", at: new Date().toISOString() }),
            },
        }).catch(() => null);

        await (prisma as any).dealPacket.updateMany({
            where: { id: packet.id, status: { in: ["sent", "viewed"] } },
            data: { status: "meeting_booked" },
        }).catch(() => null);

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}

export const POST = withApiLogging("/api/public/deal/[slug]/cta", "POST", POSTHandler);
