import { withApiLogging } from "@/lib/logger";
/**
 * app/api/org/[slug]/outbound/sequences/[seqId]/route.ts
 * V21: PATCH — Pause or resume an outbound sequence.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";

interface Params { params: Promise<{ slug: string; seqId: string }> }

async function PATCHHandler(req: NextRequest, { params }: Params) {
    const { slug, seqId } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) {
        return resolveTenantRouteError(ctx, "Failed to resolve outbound sequence context");
    }
    try {
        assertTenantRole(ctx.role, "admin");
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to authorize outbound sequence update");
    }

    let body: { action: "pause" | "resume" };
    try { body = await req.json(); }
    catch { return invalidTenantInputResponse("Invalid JSON"); }

    if (body.action !== "pause" && body.action !== "resume") {
        return invalidTenantInputResponse("action must be 'pause' or 'resume'");
    }

    const { prisma } = await import("@/lib/prisma");

    const paused = body.action === "pause";
    const result = await prisma.outboundSequence.updateMany({
        where: { id: seqId, orgId: ctx.orgId },
        data: { paused },
    });
    if (!result.count) {
        return tenantNotFoundResponse("Outbound sequence not found");
    }

    return NextResponse.json({ message: paused ? "Sequência pausada" : "Sequência retomada", paused });
}

export const PATCH = withApiLogging("/api/org/[slug]/outbound/sequences/[seqId]", "PATCH", PATCHHandler);
