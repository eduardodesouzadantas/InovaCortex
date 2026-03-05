import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { calculateROI } from "@/lib/roi-engine";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/admin/leads/[id]/roi
 * Returns ROI projection for a lead.
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

    const { id } = await params;
    const roi = await (prisma as any).roiProjection.findUnique({ where: { assessmentId: id } });

    if (!roi) {
        return NextResponse.json({ error: "Sem projeção de ROI para este lead" }, { status: 404 });
    }

    return NextResponse.json({ roi });
}

/**
 * PATCH /api/admin/leads/[id]/roi
 * Simulate adjusted ROI with custom parameters and save as manualOverride.
 * Body: { avgHourlyCost?, avgTicket?, conversionRate? }
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
    const body = await request.json();
    const { avgHourlyCost, avgTicket, conversionRate } = body;

    const assessment = await (prisma as any).assessment.findUnique({
        where: { id: assessmentId }
    });

    if (!assessment) {
        return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }

    const roi = calculateROI({
        teamSize: assessment.teamSize,
        volumeDay: assessment.volumeDay,
        scoreTotal: assessment.scoreTotal,
        classification: assessment.classification,
        pains: JSON.parse(assessment.pains || "[]"),
        avgHourlyCost: avgHourlyCost ?? 80,
        avgTicket: avgTicket ?? 2000,
        conversionRate: conversionRate ?? 5,
    });

    const updated = await (prisma as any).roiProjection.upsert({
        where: { assessmentId },
        update: {
            operationalSavingsEstimate: roi.operationalSavingsEstimate,
            revenueIncreaseEstimate: roi.revenueIncreaseEstimate,
            monthlyHoursRecovered: roi.monthlyHoursRecovered,
            estimatedPaybackMonths: roi.estimatedPaybackMonths,
            confidenceLevel: roi.confidenceLevel,
            manualOverride: true,
            avgHourlyCost: avgHourlyCost ?? null,
            avgTicket: avgTicket ?? null,
            conversionRate: conversionRate ?? null,
        },
        create: {
            assessmentId,
            operationalSavingsEstimate: roi.operationalSavingsEstimate,
            revenueIncreaseEstimate: roi.revenueIncreaseEstimate,
            monthlyHoursRecovered: roi.monthlyHoursRecovered,
            estimatedPaybackMonths: roi.estimatedPaybackMonths,
            confidenceLevel: roi.confidenceLevel,
            manualOverride: true,
            avgHourlyCost: avgHourlyCost ?? null,
            avgTicket: avgTicket ?? null,
            conversionRate: conversionRate ?? null,
        },
    });

    await logAudit("presales", assessmentId, "roiAdjusted", {
        avgHourlyCost, avgTicket, conversionRate,
        savings: roi.operationalSavingsEstimate
    });

    logger.info("ROI adjusted by admin", { assessmentId });

    return NextResponse.json({ success: true, roi: { ...updated, ...roi } });
}
