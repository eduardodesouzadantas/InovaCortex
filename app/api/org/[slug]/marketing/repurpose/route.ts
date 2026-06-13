/**
 * app/api/org/[slug]/marketing/repurpose/route.ts
 * POST generates repurpose artifacts; PATCH mutates artifact status.
 */

import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import { logger, withApiLogging } from "@/lib/logger";
import { repurposeFromPlan } from "@/lib/repurpose/repurpose-engine";
import { NextRequest, NextResponse } from "next/server";

interface Params {
    params: Promise<{ slug: string }>;
}

async function POSTHandler(req: NextRequest, { params }: Params) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) {
        return resolveTenantRouteError(ctx, "Failed to resolve repurpose context");
    }
    try {
        assertTenantRole(ctx.role, "admin");
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to authorize repurpose generation");
    }

    let body: { marketingPlanId?: string };
    try {
        body = await req.json();
    } catch {
        return invalidTenantInputResponse("Invalid JSON");
    }

    if (!body.marketingPlanId) {
        return invalidTenantInputResponse("marketingPlanId required");
    }

    const { prisma } = await import("@/lib/prisma");
    const plan = await prisma.marketingPlan.findFirst({
        where: { id: body.marketingPlanId, orgId: ctx.orgId },
        select: { id: true, orgId: true },
    });

    if (!plan) {
        return tenantNotFoundResponse("Plan not found");
    }

    try {
        const result = await repurposeFromPlan(plan.orgId, body.marketingPlanId);
        return NextResponse.json({
            artifactId: result.artifactId,
            fromCache: result.fromCache,
            message: "Repurpose processado",
            stub: result.stub,
            tokensUsed: result.tokensUsed,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[RepurposeAPI] POST failed", { marketingPlanId: body.marketingPlanId, error: message });
        return resolveTenantRouteError(error, "Failed to generate repurpose artifact");
    }
}

async function PATCHHandler(req: NextRequest, { params }: Params) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) {
        return resolveTenantRouteError(ctx, "Failed to resolve repurpose context");
    }
    try {
        assertTenantRole(ctx.role, "admin");
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to authorize repurpose update");
    }

    let body: { action?: string; artifactId?: string };
    try {
        body = await req.json();
    } catch {
        return invalidTenantInputResponse("Invalid JSON");
    }

    const { artifactId, action } = body;
    if (!artifactId || !action) {
        return invalidTenantInputResponse("artifactId and action required");
    }

    const { prisma } = await import("@/lib/prisma");
    const artifact = await prisma.repurposeArtifact.findFirst({
        where: { id: artifactId, orgId: ctx.orgId },
        select: { id: true },
    });

    if (!artifact) {
        return tenantNotFoundResponse("Artifact not found");
    }

    const statusMap: Record<string, { label: string; next: string }> = {
        approve: { next: "approved", label: "Aprovado!" },
        publish: { next: "published", label: "Publicado!" },
        review: { next: "reviewed", label: "Enviado para revisão" },
    };

    const transition = statusMap[action];
    if (!transition) {
        return invalidTenantInputResponse(`Unknown action: ${action}`);
    }

    await prisma.repurposeArtifact.update({
        where: { id: artifactId },
        data: { status: transition.next },
    });

    return NextResponse.json({ message: transition.label, status: transition.next });
}

export const POST = withApiLogging("/api/org/[slug]/marketing/repurpose", "POST", POSTHandler);
export const PATCH = withApiLogging("/api/org/[slug]/marketing/repurpose", "PATCH", PATCHHandler);
