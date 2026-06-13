import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { runStrategyAnalysis } from "@/lib/strategy/strategy-engine";
import { buildExperimentDrafts } from "@/lib/strategy/experiments";
import { requireOrgContext } from "@/lib/auth/org-context";
import { resolveTenantRouteError } from "@/lib/auth/tenant-route";

async function GETHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const slug = (await params).slug;
        const auth = await requireOrgContext(slug);

        const analysis = await runStrategyAnalysis(auth.orgId);
        const topBottleneck = analysis.bottlenecks[0];
        const experimentSuggestions = topBottleneck
            ? buildExperimentDrafts(topBottleneck.type)
            : [];

        return NextResponse.json({
            ...analysis,
            experimentSuggestions
        });
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to load strategy recommendations");
    }
}

export const GET = withApiLogging("/api/org/[slug]/strategy/recommendations", "GET", GETHandler);
