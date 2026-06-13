import { withApiLogging } from "@/lib/logger";
/**
 * app/api/org/[slug]/outbound/sequences/route.ts
 * V21: POST — Start outbound sequence for a prospect.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import { startOutboundSequence } from "@/lib/outbound/outbound-engine";

interface Params { params: Promise<{ slug: string }> }

async function POSTHandler(req: NextRequest, { params }: Params) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) {
        return resolveTenantRouteError(ctx, "Failed to resolve outbound sequence context");
    }
    try {
        assertTenantRole(ctx.role, "admin");
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to authorize outbound sequence start");
    }

    let body: { prospectId?: string };
    try { body = await req.json(); }
    catch { return invalidTenantInputResponse("Invalid JSON"); }

    if (!body.prospectId) return invalidTenantInputResponse("prospectId required");

    try {
        const result = await startOutboundSequence(ctx.orgId, body.prospectId);
        return NextResponse.json({ message: "Sequência iniciada", ...result });
    } catch (err) {
        if (err instanceof Error && err.message === "PROSPECT_NOT_FOUND") {
            return tenantNotFoundResponse("Prospect not found");
        }
        return resolveTenantRouteError(err, "Failed to start outbound sequence");
    }
}

export const POST = withApiLogging("/api/org/[slug]/outbound/sequences", "POST", POSTHandler);
