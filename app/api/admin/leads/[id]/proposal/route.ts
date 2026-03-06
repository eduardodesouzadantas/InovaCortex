import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { generateProposal } from "@/lib/proposal-engine";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/admin/leads/[id]/proposal
 * Generate (or regenerate) a proposal for a lead.
 */
export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token");
    if (!token || token.value !== "authenticated_true") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: assessmentId } = await params;

    const [assessment, roiProjection, lastPreSales, existingProposals] = await Promise.all([
        (prisma as any).assessment.findUnique({ where: { id: assessmentId } }),
        (prisma as any).roiProjection.findUnique({ where: { assessmentId } }),
        (prisma as any).preSalesArtifact.findFirst({
            where: { assessmentId },
            orderBy: { version: "desc" },
        }),
        (prisma as any).proposal.findMany({
            where: { assessmentId },
            orderBy: { version: "desc" },
            take: 1,
        }),
    ]);

    if (!assessment) {
        return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }

    const existingVersion = existingProposals[0]?.version ?? 0;

    const proposal = generateProposal({
        assessment,
        roiProjection,
        lastPreSales,
        existingVersion,
    });

    const saved = await (prisma as any).proposal.create({
        data: {
            assessmentId,
            version: proposal.version,
            publicSlug: proposal.publicSlug,
            modules: JSON.stringify(proposal.modules),
            pricingEstimate: JSON.stringify(proposal.pricingEstimate),
            roiSnapshot: JSON.stringify(proposal.roiSnapshot),
            presalesSnapshot: JSON.stringify(proposal.presalesSnapshot),
            status: "draft",
        }
    });

    await logAudit("presales", assessmentId, "proposalGenerated", {
        version: proposal.version,
        modules: proposal.modules.length,
        minBRL: proposal.pricingEstimate.minBRL,
        maxBRL: proposal.pricingEstimate.maxBRL,
    });

    logger.info("Proposal generated", { assessmentId, version: proposal.version });

    return NextResponse.json({
        success: true,
        proposal: {
            ...saved,
            ...proposal,
        }
    });
}

/**
 * GET /api/admin/leads/[id]/proposal
 * Get all proposal versions for a lead.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token");
    if (!token || token.value !== "authenticated_true") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: assessmentId } = await params;

    const proposals = await (prisma as any).proposal.findMany({
        where: { assessmentId },
        orderBy: { version: "desc" },
    });

    return NextResponse.json({
        proposals: proposals.map((p: any) => ({
            ...p,
            modules: JSON.parse(p.modules),
            pricingEstimate: JSON.parse(p.pricingEstimate),
            roiSnapshot: JSON.parse(p.roiSnapshot),
            presalesSnapshot: JSON.parse(p.presalesSnapshot),
        }))
    });
}

/**
 * PATCH /api/admin/leads/[id]/proposal
 * Update status or customNotes of the latest proposal.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token");
    if (!token || token.value !== "authenticated_true") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: assessmentId } = await params;
    const { proposalId, status, customNotes, modules } = await request.json();

    if (!proposalId) {
        return NextResponse.json({ error: "proposalId required" }, { status: 400 });
    }

    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (customNotes !== undefined) updateData.customNotes = customNotes;
    if (modules) updateData.modules = JSON.stringify(modules);

    const updated = await (prisma as any).proposal.update({
        where: { id: proposalId },
        data: updateData,
    });

    const action = status ? "proposalStatusChanged" : "proposalUpdated";
    await logAudit("presales", assessmentId, action, { proposalId, status, customNotes: !!customNotes });

    return NextResponse.json({ success: true, proposal: updated });
}
