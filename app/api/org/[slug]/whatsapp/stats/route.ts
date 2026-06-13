import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { resolveTenantRouteError } from "@/lib/auth/tenant-route";
import { calculateInboxStats } from "@/lib/whatsapp/engines/metrics-engine";

async function GETHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { orgId } = await requireOrgContext((await params).slug);
        const stats = await calculateInboxStats(orgId);
        return NextResponse.json(stats, { status: 200 });
    } catch (e) {
        return resolveTenantRouteError(e, "Failed to load WhatsApp stats");
    }
}

export const GET = withApiLogging("/api/org/[slug]/whatsapp/stats", "GET", GETHandler);
