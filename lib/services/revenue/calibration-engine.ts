/**
 * lib/services/revenue/calibration-engine.ts
 * V17: Recalibrates close probability for a MeetingSession.
 *
 * Rules:
 * - Floor: 0.05 / Cap: 0.92
 * - Applies EMA smoothing against current closeProbability
 * - Accounts for: tier, ROI value, days since last interaction,
 *   org historical close rate (30d), ticket mean, meeting hour
 */

import { prisma } from "@/lib/prisma";

export interface CalibrationResult {
    adjustedProbability: number;
    confidenceScore: number;    // 0-1: how reliable is this estimate
    reasons: string[];
}

// EMA smoothing factor (0 = ignore new signal, 1 = pure new signal)
const EMA_ALPHA = 0.35;

// Base probabilities by tier
const TIER_BASE: Record<string, number> = {
    hot: 0.72,
    warm: 0.42,
    cold: 0.18,
};

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

function ema(current: number, newSignal: number, alpha: number): number {
    return alpha * newSignal + (1 - alpha) * current;
}

export async function calibrateCloseProbability(meetingSessionId: string): Promise<CalibrationResult> {
    const session = await (prisma as any).meetingSession.findUnique({
        where: { id: meetingSessionId }
    });
    if (!session) return { adjustedProbability: 0.1, confidenceScore: 0.1, reasons: ["session_not_found"] };

    const orgId = session.organizationId;
    const reasons: string[] = [];
    let signal = TIER_BASE[session.priorityTier] ?? 0.25;
    let confidence = 0.5;

    // ─── 1. ROI Boost ─────────────────────────────────────────────────────────
    const assessment = session.assessmentId
        ? await (prisma as any).assessment.findUnique({ where: { id: session.assessmentId } })
        : null;
    const roi = assessment
        ? await (prisma as any).rOIEstimate.findFirst({ where: { assessmentId: assessment.id } })
        : null;

    if (roi) {
        const roiAnnual = roi.annualROI ?? 0;
        // +0.08 for ROI > 50k; +0.04 for ROI 10–50k
        const roiBoost = roiAnnual >= 50_000 ? 0.08 : roiAnnual >= 10_000 ? 0.04 : 0;
        signal += roiBoost;
        if (roiBoost > 0) reasons.push(`roi_boost+${roiBoost.toFixed(2)}`);
        confidence += 0.1;
    }

    // ─── 2. Recency Penalty ──────────────────────────────────────────────────
    const lastAudit = await (prisma as any).auditEvent.findFirst({
        where: { organizationId: orgId, resourceId: meetingSessionId, action: { not: "meetingLifecycleEnqueued" } },
        orderBy: { createdAt: "desc" }
    });
    if (lastAudit) {
        const daysSince = (Date.now() - new Date(lastAudit.createdAt).getTime()) / 86_400_000;
        if (daysSince > 7) { signal -= 0.10; reasons.push("stale_7d"); }
        else if (daysSince > 3) { signal -= 0.05; reasons.push("stale_3d"); }
        confidence += 0.05;
    }

    // ─── 3. Org Historical Close Rate (30d) ──────────────────────────────────
    const since30d = new Date(Date.now() - 30 * 86_400_000);
    const recentPerfs = await (prisma as any).meetingPerformance.findMany({
        where: { organizationId: orgId, createdAt: { gte: since30d } }
    });
    if (recentPerfs.length >= 3) {
        const won = recentPerfs.filter((p: any) => p.outcome === "won").length;
        const orgCloseRate = won / recentPerfs.length;
        // Blend org close rate into signal
        signal = ema(signal, orgCloseRate, 0.25);
        reasons.push(`org_close_rate:${(orgCloseRate * 100).toFixed(0)}%`);
        confidence += 0.15;
    }

    // ─── 4. Meeting Hour Adjustment ───────────────────────────────────────────
    const hour = new Date(session.startAt).getHours();
    // Morning (9–11) and early afternoon (14–16) more likely to close
    if (hour >= 9 && hour <= 11) { signal += 0.03; reasons.push("prime_hour_morning"); }
    if (hour >= 14 && hour <= 16) { signal += 0.02; reasons.push("prime_hour_afternoon"); }
    if (hour < 8 || hour >= 19) { signal -= 0.05; reasons.push("off_hour_penalty"); }

    // ─── 5. Proposal Status Modifier ──────────────────────────────────────────
    if (assessment) {
        const proposal = await (prisma as any).proposal.findFirst({
            where: { assessmentId: assessment.id },
            orderBy: { createdAt: "desc" }
        });
        if (proposal?.status === "accepted") { signal = 0.92; reasons.push("proposal_accepted"); }
        else if (proposal?.status === "rejected") { signal = 0.05; reasons.push("proposal_rejected"); }
        else if (proposal?.status === "sent") { signal += 0.06; reasons.push("proposal_sent"); confidence += 0.1; }
    }

    // ─── 6. EMA smooth against existing closeProbability ──────────────────────
    const prev = session.adjustedProbability ?? session.closeProbability ?? signal;
    const adjusted = ema(prev, signal, EMA_ALPHA);
    const final = clamp(adjusted, 0.05, 0.92);
    confidence = clamp(confidence, 0.1, 0.95);

    return {
        adjustedProbability: Math.round(final * 1000) / 1000,
        confidenceScore: Math.round(confidence * 100) / 100,
        reasons,
    };
}
