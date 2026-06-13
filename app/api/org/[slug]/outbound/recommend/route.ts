import { withApiLogging } from "@/lib/logger";
/**
 * app/api/org/[slug]/outbound/recommend/route.ts
 * V21: POST — Generate 25 stub prospects.
 * app/api/org/[slug]/outbound/sequences/route.ts
 * V21: POST — Start/resume outbound sequence.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertTenantRole, resolveTenantRouteError } from "@/lib/auth/tenant-route";
import { recommendProspects } from "@/lib/outbound/outbound-engine";

interface Params { params: Promise<{ slug: string }> }

async function POSTHandler(req: NextRequest, { params }: Params) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) {
        return resolveTenantRouteError(ctx, "Failed to resolve outbound recommendation context");
    }
    try {
        assertTenantRole(ctx.role, "admin");
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to authorize outbound recommendations");
    }

    try {
        const result = await recommendProspects(ctx.orgId, 25);
        return NextResponse.json({ message: "Prospects gerados", ...result });
    } catch (err) {
        return resolveTenantRouteError(err, "Failed to recommend prospects");
    }
}

export const POST = withApiLogging("/api/org/[slug]/outbound/recommend", "POST", POSTHandler);
