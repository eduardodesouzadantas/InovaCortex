/**
 * app/api/org/[slug]/radar/route.ts
 * V23: GET radar payload for an org.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadRadar } from "@/lib/radar/radar-loader";
import { logger, withApiLogging } from "@/lib/logger";
import { requireOrgContext } from "@/lib/auth/org-context";
import { resolveTenantRouteError, tenantContextErrorResponse } from "@/lib/auth/tenant-route";

async function GETHandler(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;

    try {
        const { orgId } = await requireOrgContext(slug);
        const payload = await loadRadar(orgId);

        return NextResponse.json(payload, {
            headers: {
                "Cache-Control": "private, no-store",
            },
        });
    } catch (err: unknown) {
        const authResponse = tenantContextErrorResponse(err);
        if (authResponse) return authResponse;

        const message = err instanceof Error ? err.message : String(err);
        logger.error("[RadarAPI]", { slug, err: message });
        return resolveTenantRouteError(err, "Failed to load radar");
    }
}

export const GET = withApiLogging("/api/org/[slug]/radar", "GET", GETHandler);
