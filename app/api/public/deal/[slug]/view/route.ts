import { withApiLogging } from "@/lib/logger";
/**
 * app/api/public/deal/[slug]/view/route.ts
 * V21: Public endpoint — records DealSignal "dossier_viewed" (client-triggered).
 * No auth. Rate-limited by slug lookup.
 */

import { NextRequest, NextResponse } from "next/server";

interface Params { params: Promise<{ slug: string }> }

async function POSTHandler(req: NextRequest, { params }: Params) {
    try {
        const { prisma } = await import("@/lib/prisma");

        const packet = await (prisma as any).dealPacket.findUnique({
            where: { execSlug: (await params).slug },
            select: { id: true, orgId: true, assessmentId: true, status: true },
        }).catch(() => null);

        if (!packet) return NextResponse.json({ ok: false }, { status: 404 });

        await (prisma as any).dealSignal.create({
            data: {
                orgId: packet.orgId,
                assessmentId: packet.assessmentId,
                dealPacketId: packet.id,
                type: "dossier_viewed",
                metadataJson: JSON.stringify({ source: "client_page", at: new Date().toISOString() }),
            },
        }).catch(() => null);

        if (packet.status === "sent") {
            await (prisma as any).dealPacket.update({
                where: { id: packet.id },
                data: { status: "viewed" },
            }).catch(() => null);
        }

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}

export const POST = withApiLogging("/api/public/deal/[slug]/view", "POST", POSTHandler);
