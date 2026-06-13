import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";
import { getLiveKPIs } from "@/lib/kpi-engine";

export const dynamic = "force-dynamic";

async function GETHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const auth = await requireOrgContext(slug);
        const kpis = await getLiveKPIs(auth.orgId);
        return NextResponse.json(kpis);
    } catch (e) {
        if (e instanceof Error && ["UNAUTHENTICATED", "ORG_NOT_FOUND", "FORBIDDEN"].includes(e.message)) {
            return orgContextErrorResponse(e);
        }
        const detail = e instanceof Error ? e.message : "Failed to load KPIs";
        return NextResponse.json({ error: detail }, { status: 500 });
    }
}

export const GET = withApiLogging("/api/org/[slug]/kpis", "GET", GETHandler);
