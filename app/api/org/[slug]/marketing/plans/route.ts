/**
 * app/api/org/[slug]/marketing/plans/route.ts
 * PATCH endpoint for MarketingPlan status mutations.
 */

import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import { publishOne } from "@/lib/agents/publisher-agent";
import { logger, withApiLogging } from "@/lib/logger";
import { getBestSendHour } from "@/lib/services/deal-optimization/send-window";
import { NextRequest, NextResponse } from "next/server";

interface Params {
    params: Promise<{ slug: string }>;
}

async function PATCHHandler(req: NextRequest, { params }: Params) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) {
        return resolveTenantRouteError(ctx, "Failed to resolve marketing plan context");
    }
    try {
        assertTenantRole(ctx.role, "admin");
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to authorize marketing plan update");
    }

    let body: { action?: string; planId?: string };
    try {
        body = await req.json();
    } catch {
        return invalidTenantInputResponse("Invalid JSON");
    }

    const { planId, action } = body;
    if (!planId || !action) {
        return invalidTenantInputResponse("planId and action required");
    }

    const { prisma } = await import("@/lib/prisma");
    const plan = await prisma.marketingPlan.findFirst({
        where: { id: planId, orgId: ctx.orgId },
        select: { id: true, orgId: true, status: true },
    });

    if (!plan) {
        return tenantNotFoundResponse("Plan not found");
    }

    try {
        switch (action) {
            case "review": {
                if (plan.status !== "draft") {
                    return NextResponse.json({ error: `Cannot review from status '${plan.status}'` }, { status: 422 });
                }
                await prisma.marketingPlan.update({
                    where: { id: planId },
                    data: { status: "reviewed" },
                });
                return NextResponse.json({ message: "Enviado para revisão", status: "reviewed" });
            }
            case "approve": {
                if (!["draft", "reviewed"].includes(plan.status)) {
                    return NextResponse.json({ error: `Cannot approve from status '${plan.status}'` }, { status: 422 });
                }
                await prisma.marketingPlan.update({
                    where: { id: planId },
                    data: { status: "approved" },
                });
                return NextResponse.json({ message: "Post aprovado!", status: "approved" });
            }
            case "schedule": {
                if (plan.status !== "approved") {
                    return NextResponse.json({ error: "Only approved plans can be scheduled" }, { status: 422 });
                }
                let bestHour = 10;
                try {
                    const sendWindow = await getBestSendHour(plan.orgId);
                    bestHour = sendWindow.hour;
                } catch {
                    bestHour = 10;
                }
                const now = new Date();
                const scheduledFor = new Date();
                scheduledFor.setHours(bestHour, 0, 0, 0);
                if (scheduledFor <= now) {
                    scheduledFor.setDate(scheduledFor.getDate() + 1);
                }
                await prisma.marketingPlan.update({
                    where: { id: planId },
                    data: { status: "scheduled", scheduledFor },
                });
                return NextResponse.json({ message: "Agendado com sucesso", status: "scheduled", scheduledFor });
            }
            case "publish": {
                const result = await publishOne(planId);
                logger.info("[MarketingAPI] publishOne result", { planId, status: result.status });
                return NextResponse.json({ message: "Publicação processada", status: result.status, stub: result.stub });
            }
            default:
                return invalidTenantInputResponse(`Unknown action: ${action}`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[MarketingAPI] Mutation failed", { planId, action, error: message });
        return resolveTenantRouteError(error, "Failed to update marketing plan");
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/marketing/plans", "PATCH", PATCHHandler);
