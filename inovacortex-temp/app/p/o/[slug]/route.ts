import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: NextRequest,
    { params }: { params: { slug: string } }
) {
    const { slug } = params;

    const offer = await prisma.offer.findUnique({
        where: { publishedSlug: slug },
        include: { assets: true }
    });

    if (!offer) {
        return new NextResponse("Offer not found", { status: 404 });
    }

    const htmlAsset = offer.assets.find(a => a.type === 'one_pager_html');
    if (!htmlAsset) {
        return new NextResponse("Offer asset not generated", { status: 500 });
    }

    // Log view event
    await prisma.auditEvent.create({
        data: {
            action: "offer_viewed",
            details: `Offer: ${offer.name} (${offer.id})`,
            organizationId: offer.organizationId
        }
    });

    return new NextResponse(htmlAsset.content, {
        headers: { "Content-Type": "text/html" }
    });
}
