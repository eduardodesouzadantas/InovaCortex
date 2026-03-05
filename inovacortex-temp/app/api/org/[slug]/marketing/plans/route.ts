/**
 * app/api/org/[slug]/marketing/plans/route.ts
 * V20.1: PATCH endpoint for MarketingPlan status mutations.
 *
 * Actions:
 *   review   → status: reviewed
 *   approve  → status: approved
 *   schedule → status: scheduled + scheduledFor = best hour today/tomorrow
 *   publish  → calls publishOne(planId) → status: posted | ready_to_post
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { publishOne } from "@/lib/agents/publisher-agent";
import { getBestSendHour } from "@/lib/services/deal-optimization/send-window";
import { logger } from "@/lib/logger";

interface Params { params: { slug: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions as any).catch(() => null);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { planId: string; action: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { planId, action } = body;
    if (!planId || !action) return NextResponse.json({ error: "planId and action required" }, { status: 400 });

    const { prisma } = await import("@/lib/prisma");

    // Verify plan belongs to correct org
    const plan = await (prisma as any).marketingPlan.findUnique({
        where: { id: planId },
        select: { id: true, orgId: true, status: true, platform: true, day: true },
    }).catch(() => null);

    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    // Verify org slug ownership
    const org = await (prisma as any).organization.findUnique({
        where: { slug: params.slug },
        select: { id: true },
    }).catch(() => null);

    if (!org || org.id !== plan.orgId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        switch (action) {
            case "review": {
                if (!["draft"].includes(plan.status)) {
                    return NextResponse.json({ error: `Cannot review from status '${plan.status}'` }, { status: 422 });
                }
                await (prisma as any).marketingPlan.update({
                    where: { id: planId },
                    data: { status: "reviewed" },
                });
                return NextResponse.json({ message: "Enviado para revisão", status: "reviewed" });
            }

            case "approve": {
                if (!["draft", "reviewed"].includes(plan.status)) {
                    return NextResponse.json({ error: `Cannot approve from status '${plan.status}'` }, { status: 422 });
                }
                await (prisma as any).marketingPlan.update({
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
                    const sw = await getBestSendHour(plan.orgId);
                    bestHour = sw.hour;
                } catch { /* fallback 10 */ }
                const now = new Date();
                const scheduledFor = new Date();
                scheduledFor.setHours(bestHour, 0, 0, 0);
                // If best hour today already passed, schedule for tomorrow
                if (scheduledFor <= now) {
                    scheduledFor.setDate(scheduledFor.getDate() + 1);
                }
                await (prisma as any).marketingPlan.update({
                    where: { id: planId },
                    data: { status: "scheduled", scheduledFor },
                });
                const label = scheduledFor.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
                return NextResponse.json({ message: `Agendado para ${label}`, status: "scheduled", scheduledFor });
            }

            case "publish": {
                const result = await publishOne(planId);
                logger.info("[MarketingAPI] publishOne result", { planId, status: result.status });
                const msg = result.status === "posted"
                    ? "Publicado com sucesso! ✅"
                    : result.status === "ready_to_post"
                        ? "Pack pronto para publicação manual 📋"
                        : `Status: ${result.status}`;
                return NextResponse.json({ message: msg, status: result.status, stub: result.stub });
            }

            default:
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (err: any) {
        logger.error("[MarketingAPI] Mutation failed", { planId, action, error: err?.message });
        return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
    }
}
