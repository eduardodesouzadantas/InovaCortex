import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildOfferDraft } from "@/lib/offers/offer-engine";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    const offers = await prisma.offer.findMany({
        where: { organizationId: org.id },
        orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json(offers);
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const { niche } = await req.json();
    const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    const draft = buildOfferDraft(org.id, niche);

    const offer = await prisma.offer.create({
        data: {
            organizationId: org.id,
            name: draft.name,
            niche: draft.niche,
            priceCents: draft.priceCents,
            currency: draft.currency,
            offerJson: JSON.stringify({
                promise: draft.promise,
                deliverables: draft.deliverables,
                timeline: draft.timeline,
                guarantees: draft.guarantees,
                exclusions: draft.exclusions
            }),
            roiModelJson: JSON.stringify(draft.roiVariables)
        }
    });

    return NextResponse.json(offer);
}
