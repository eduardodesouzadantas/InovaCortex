import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runStrategyAnalysis } from "@/lib/strategy/strategy-engine";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const slug = (await params).slug;

    const org = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true }
    });

    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    // In a real app, this might clear cache
    const analysis = await runStrategyAnalysis(org.id);

    return NextResponse.json(analysis);
}
