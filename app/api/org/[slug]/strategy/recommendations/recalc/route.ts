import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { profileRequest, profileStep } from "@/lib/request-profiler";
import { recalculateStrategyAnalysis } from "@/lib/strategy/strategy-engine";
import { requireOrgContext } from "@/lib/auth/org-context";
import { resolveTenantRouteError } from "@/lib/auth/tenant-route";

async function POSTHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    return profileRequest({ route: "/api/org/[slug]/strategy/recommendations/recalc", method: "POST", targetMs: 500 }, async () => {
        try {
            const slug = (await params).slug;
            const auth = await requireOrgContext(slug);
            const analysis = await profileStep("strategy.recalculate", () => recalculateStrategyAnalysis(auth.orgId));

            return NextResponse.json(analysis);
        } catch (error) {
            return resolveTenantRouteError(error, "Failed to recalculate strategy recommendations");
        }
    });
}

export const POST = withApiLogging("/api/org/[slug]/strategy/recommendations/recalc", "POST", POSTHandler);
