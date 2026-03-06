import { NextRequest, NextResponse } from "next/server";
import { publishOffer } from "@/lib/offers/publish";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> }
) {
    const { id } = await params;

    try {
        const published = await publishOffer(id);
        return NextResponse.json(published);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
