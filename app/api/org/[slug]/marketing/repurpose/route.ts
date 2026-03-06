/**
 * app/api/org/[slug]/marketing/repurpose/route.ts
 * V21: API endpoints for RepurposeArtifact actions.
 *
 * POST /api/org/[slug]/marketing/repurpose
 *   → generate repurpose for a marketingPlanId
 *
 * PATCH /api/org/[slug]/marketing/repurpose
 *   → review | approve | status mutation on artifact
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { repurposeFromPlan } from "@/lib/repurpose/repurpose-engine";
import { logger } from "@/lib/logger";

interface Params { params: Promise<{ slug: string }> }

// ─── POST: Generate repurpose ─────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
    const { slug } = await params;
    let ctx;
    try { ctx = await requireOrgContext(slug); }
    catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

    let body: { marketingPlanId: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { marketingPlanId } = body;
    if (!marketingPlanId) return NextResponse.json({ error: "marketingPlanId required" }, { status: 400 });

    const { prisma } = await import("@/lib/prisma");

    const plan = await (prisma as any).marketingPlan.findUnique({
        where: { id: marketingPlanId },
        select: { id: true, orgId: true, status: true },
    }).catch(() => null);

    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    if (ctx.orgId !== plan.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const result = await repurposeFromPlan(plan.orgId, marketingPlanId);
        return NextResponse.json({
            artifactId: result.artifactId,
            stub: result.stub,
            fromCache: result.fromCache,
            tokensUsed: result.tokensUsed,
            message: result.stub
                ? "Repurpose gerado (STUB — sem API key ou orçamento)"
                : result.fromCache
                    ? "Repurpose carregado do cache 🚀"
                    : "Repurpose gerado com IA ✅",
        });
    } catch (err: any) {
        logger.error("[RepurposeAPI] POST failed", { marketingPlanId, error: err?.message });
        return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
    }
}

// ─── PATCH: Artifact status mutation ─────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
    const { slug } = await params;
    let ctx;
    try { ctx = await requireOrgContext(slug); }
    catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

    let body: { artifactId: string; action: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { artifactId, action } = body;
    if (!artifactId || !action) return NextResponse.json({ error: "artifactId and action required" }, { status: 400 });

    const { prisma } = await import("@/lib/prisma");

    const artifact = await (prisma as any).repurposeArtifact.findUnique({
        where: { id: artifactId },
        select: { id: true, orgId: true, status: true },
    }).catch(() => null);

    if (!artifact) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });

    if (ctx.orgId !== artifact.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const STATUS_MAP: Record<string, { next: string; label: string }> = {
        review: { next: "reviewed", label: "Enviado para revisão" },
        approve: { next: "approved", label: "Aprovado!" },
        publish: { next: "published", label: "Publicado!" },
    };

    const transition = STATUS_MAP[action];
    if (!transition) return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

    await (prisma as any).repurposeArtifact.update({
        where: { id: artifactId },
        data: { status: transition.next },
    });

    return NextResponse.json({ message: transition.label, status: transition.next });
}
