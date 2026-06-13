import { withApiLogging } from "@/lib/logger";
/**
 * app/api/org/[slug]/outbound/sequences/[seqId]/run/route.ts
 * V21: POST — Force run an outbound sequence step now.
 *
 * app/api/org/[slug]/outbound/sequences/[seqId]/route.ts
 * V21: PATCH — Pause or resume sequence.
 */

// This file handles: /sequences/[seqId]/run
import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import { sendNextOutboundStep } from "@/lib/outbound/outbound-engine";

interface Params { params: Promise<{ slug: string; seqId: string }> }

async function POSTHandler(req: NextRequest, { params }: Params) {
    const { slug, seqId } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) {
        return resolveTenantRouteError(ctx, "Failed to resolve outbound sequence run context");
    }
    try {
        assertTenantRole(ctx.role, "admin");
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to authorize outbound sequence run");
    }

    const { prisma } = await import("@/lib/prisma");

    // Force nextAt to now so sendNextOutboundStep runs

    // Force nextAt to now so sendNextOutboundStep runs
    const result = await prisma.outboundSequence.updateMany({
        where: { id: seqId, orgId: ctx.orgId },
        data: { nextAt: new Date() },
    }).catch(() => null);
    if (!result?.count) {
        return tenantNotFoundResponse("Outbound sequence not found");
    }

    try {
        const result = await sendNextOutboundStep(ctx.orgId, seqId);
        return NextResponse.json({ message: result.sent ? "Passo executado" : result.reason, ...result });
    } catch (err) {
        return resolveTenantRouteError(err, "Failed to run outbound sequence");
    }
}

export const POST = withApiLogging("/api/org/[slug]/outbound/sequences/[seqId]/run", "POST", POSTHandler);
