import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSystemEvent } from "@/lib/system-events";

async function POSTHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    const offer = await prisma.offer.findUnique({
        where: { publishedSlug: slug }
    });

    if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });

    // 1. Audit Event
    await prisma.auditEvent.create({
        data: {
            action: "offer_cta_clicked",
            details: `Offer: ${offer.name}`,
            organizationId: offer.organizationId
        }
    });

    // 2. Trigger System Event for WhatsApp alert
    await createSystemEvent({
        type: "meeting_scheduled",
        message: `Lead demonstrou interesse na oferta: ${offer.name}`,
        organizationId: offer.organizationId,
        payloadJson: JSON.stringify({ offerId: offer.id, source: "one_pager" }),
    });

    return NextResponse.json({ success: true });
}

export const POST = withApiLogging("/api/public/offers/[slug]/cta", "POST", POSTHandler);
