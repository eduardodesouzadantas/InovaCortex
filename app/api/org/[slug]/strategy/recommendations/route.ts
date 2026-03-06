import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runStrategyAnalysis } from "@/lib/strategy/strategy-engine";
import { buildExperimentDrafts } from "@/lib/strategy/experiments";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const slug = (await params).slug;

    // 1. Resolve Org
    const org = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true }
    });

    if (!org) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    try {
        // 2. Run Analysis
        const analysis = await runStrategyAnalysis(org.id);

        // 3. Generate Experiment Suggestions for the top bottleneck
        const topBottleneck = analysis.bottlenecks[0];
        const experimentSuggestions = topBottleneck
            ? buildExperimentDrafts(topBottleneck.type)
            : [];

        return NextResponse.json({
            ...analysis,
            experimentSuggestions
        });
    } catch (error) {
        console.error("Strategy Analysis Error:", error);
        return NextResponse.json({ error: "Failed to run analysis" }, { status: 500 });
    }
}
