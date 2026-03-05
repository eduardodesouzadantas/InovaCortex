import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: NextRequest,
    { params }: { params: { slug: string; id: string } }
) {
    const { id } = params;
    const offer = await prisma.offer.findUnique({
        where: { id },
        include: { assets: true }
    });
    if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    return NextResponse.json(offer);
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: { slug: string; id: string } }
) {
    const { id } = params;
    const body = await req.json();

    const data: any = {};
    if (body.name) data.name = body.name;
    if (body.priceCents) data.priceCents = body.priceCents;
    if (body.status) data.status = body.status;
    if (body.offerJson) data.offerJson = typeof body.offerJson === 'string' ? body.offerJson : JSON.stringify(body.offerJson);
    if (body.roiModelJson) data.roiModelJson = typeof body.roiModelJson === 'string' ? body.roiModelJson : JSON.stringify(body.roiModelJson);

    const updated = await prisma.offer.update({
        where: { id },
        data,
        include: { assets: true }
    });

    return NextResponse.json(updated);
}
