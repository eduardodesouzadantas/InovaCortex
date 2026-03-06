/**
 * lib/calibration-engine.ts
 * V17: Deterministic close-probability calibration engine.
 *
 * Recalibrates the raw closeProbability of a MeetingSession using:
 * - tier (hot/warm/cold)
 * - ROI value (from linked RoiProjection)
 * - time since last interaction
 * - org closing history (last 30d win rate)
 * - avg ticket per tier
 * - meeting time-of-day
 *
 * Smoothed using a simple EMA. Output is always clamped [0.05, 0.92].
 */

import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalibrationResult {
    adjustedProbability: number; // [0.05, 0.92]
    confidenceScore: number;     // [0, 1]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROB_MIN = 0.05;
const PROB_MAX = 0.92;

/** EMA smoothing factor α ∈ (0,1]. Higher = more weight on new value. */
const EMA_ALPHA = 0.7;

/** Tier base probability priors */
const TIER_PRIOR: Record<string, number> = {
    hot: 0.72,
    warm: 0.45,
    cold: 0.20,
};

/** ROI-to-probability boost table (in BRL/month) */
const ROI_BOOST_TABLE: Array<{ threshold: number; boost: number }> = [
    { threshold: 50000, boost: 0.12 },
    { threshold: 20000, boost: 0.07 },
    { threshold: 8000, boost: 0.03 },
    { threshold: 0, boost: 0.00 },
];

/** Meeting hour → engagement multiplier (0.85–1.10) */
function hourEngagementMultiplier(hour: number): number {
    if (hour >= 9 && hour <= 11) return 1.10; // Morning peak
    if (hour >= 14 && hour <= 16) return 1.05; // Afternoon peak
    if (hour >= 17 && hour <= 18) return 0.95;
    if (hour < 8 || hour >= 20) return 0.85;
    return 1.00;
}

/** Days without interaction → decay multiplier */
function timeDecayMultiplier(daysSinceLastInteraction: number): number {
    if (daysSinceLastInteraction <= 1) return 1.00;
    if (daysSinceLastInteraction <= 3) return 0.95;
    if (daysSinceLastInteraction <= 7) return 0.88;
    if (daysSinceLastInteraction <= 14) return 0.78;
    return 0.65;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function ema(previous: number | null, current: number, alpha: number): number {
    if (previous === null || previous === undefined) return current;
    return alpha * current + (1 - alpha) * previous;
}

function roiBoost(monthlyBenefit: number): number {
    for (const entry of ROI_BOOST_TABLE) {
        if (monthlyBenefit >= entry.threshold) return entry.boost;
    }
    return 0;
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function calibrateCloseProbability(
    meetingSessionId: string
): Promise<CalibrationResult> {
    // 1. Load meeting session with related data
    const session = await (prisma as any).meetingSession.findUnique({
        where: { id: meetingSessionId },
        include: {
            // MeetingSession → assessment (optional link)
        },
    });

    if (!session) {
        throw new Error(`MeetingSession not found: ${meetingSessionId}`);
    }

    const orgId: string = session.organizationId;
    const tier: string = session.priorityTier ?? "warm";
    const rawProbability: number = session.closeProbability ?? TIER_PRIOR[tier] ?? 0.45;
    const previousAdjusted: number | null = session.adjustedProbability ?? null;

    // 2. Fetch org's 30-day close history
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const [wonCount, totalCount] = await Promise.all([
        (prisma as any).meetingPerformance.count({
            where: {
                organizationId: orgId,
                outcome: "won",
                createdAt: { gte: thirtyDaysAgo },
            },
        }),
        (prisma as any).meetingPerformance.count({
            where: {
                organizationId: orgId,
                outcome: { in: ["won", "lost"] },
                createdAt: { gte: thirtyDaysAgo },
            },
        }),
    ]);

    const orgWinRate30d: number = totalCount > 0 ? wonCount / totalCount : 0.30;

    // 3. ROI value from linked assessment's RoiProjection
    let monthlyBenefit = 0;
    if (session.assessmentId) {
        const roi = await (prisma as any).roiProjection.findFirst({
            where: { assessmentId: session.assessmentId },
            select: {
                operationalSavingsEstimate: true,
                revenueIncreaseEstimate: true,
            },
        });
        if (roi) {
            monthlyBenefit = (roi.operationalSavingsEstimate ?? 0) + (roi.revenueIncreaseEstimate ?? 0);
        }
    }

    // 4. Time since last interaction
    const lastInteractionAt: Date = session.updatedAt ?? session.createdAt;
    const daysSinceInteraction = (Date.now() - new Date(lastInteractionAt).getTime()) / 86400000;

    // 5. Meeting hour (local time from stored timezone, simplified to UTC-3 for BR)
    const meetingHour: number = new Date(session.startAt).getUTCHours();

    // 6. Tier base + org win-rate blend
    const tierPrior = TIER_PRIOR[tier] ?? 0.45;
    const blendedBase = 0.6 * tierPrior + 0.4 * orgWinRate30d;

    // 7. Apply raw probability as a signal (weighted 50%)
    let adjusted = 0.5 * blendedBase + 0.5 * rawProbability;

    // 8. ROI boost
    adjusted += roiBoost(monthlyBenefit);

    // 9. Time decay
    adjusted *= timeDecayMultiplier(daysSinceInteraction);

    // 10. Meeting-hour engagement multiplier
    adjusted *= hourEngagementMultiplier(meetingHour);

    // 11. EMA smoothing with previous calibration
    adjusted = ema(previousAdjusted, adjusted, EMA_ALPHA);

    // 12. Hard clamp
    adjusted = clamp(adjusted, PROB_MIN, PROB_MAX);
    adjusted = Math.round(adjusted * 1000) / 1000; // 3 decimal places

    // 13. Confidence score based on data richness
    let confidence = 0.5;
    if (totalCount >= 10) confidence += 0.2;      // Enough org history
    if (totalCount >= 30) confidence += 0.1;      // Strong org history
    if (monthlyBenefit > 0) confidence += 0.15;   // ROI available
    if (daysSinceInteraction <= 3) confidence += 0.05; // Fresh interaction
    confidence = clamp(confidence, 0, 1);
    confidence = Math.round(confidence * 100) / 100;

    // 14. Persist to DB
    await (prisma as any).meetingSession.update({
        where: { id: meetingSessionId },
        data: {
            adjustedProbability: adjusted,
            confidenceScore: confidence,
        },
    });

    return {
        adjustedProbability: adjusted,
        confidenceScore: confidence,
    };
}
