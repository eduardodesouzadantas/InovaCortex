/**
 * app/org/[slug]/deal/[execSlug]/page.tsx
 * V21: Public Executive One-Pager (client-facing, anti-commodity).
 *
 * - Renders execOnePagerHtml from DealPacket
 * - Records DealSignal "dossier_viewed" on load
 * - No auth required (public URL with slug)
 * - noindex, nofollow (metadata)
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props {
    params: { slug: string; execSlug: string };
}

export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

async function getDealPacket(execSlug: string) {
    const { prisma } = await import("@/lib/prisma");
    return (prisma as any).dealPacket.findUnique({
        where: { execSlug },
        select: { id: true, orgId: true, assessmentId: true, execOnePagerHtml: true, status: true },
    }).catch(() => null);
}

async function recordView(dealPacketId: string, orgId: string, assessmentId: string) {
    const { prisma } = await import("@/lib/prisma");
    await (prisma as any).dealSignal.create({
        data: {
            orgId, assessmentId, dealPacketId,
            type: "dossier_viewed",
            metadataJson: JSON.stringify({ at: new Date().toISOString() }),
        },
    }).catch(() => null);

    await (prisma as any).dealPacket.updateMany({
        where: { id: dealPacketId, status: "sent" },
        data: { status: "viewed" },
    }).catch(() => null);
}

export default async function DealPage({ params }: Props) {
    const packet = await getDealPacket(params.execSlug);
    if (!packet) notFound();

    // Record view server-side (best-effort)
    await recordView(packet.id, packet.orgId, packet.assessmentId);

    // Render the full HTML document inline using dangerouslySetInnerHTML
    // The HTML is fully self-contained (fonts, styles, no external deps)
    return (
        <div
            dangerouslySetInnerHTML={{ __html: packet.execOnePagerHtml }}
            style={{ all: "unset" }}
        />
    );
}
