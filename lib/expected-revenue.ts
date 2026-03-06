/**
 * lib/expected-revenue.ts
 * V17: Expected Revenue & Priority Weight calculator.
 *
 * Formula:
 *   expectedRevenue = potentialRevenue × adjustedProbability
 *
 * priorityWeight (0–100) is computed by normalizing expectedRevenue
 * against all active pipeline sessions for the org (percentile rank).
 *
 * Persists expectedRevenue back to MeetingSession and updates
 * the related ActionQueue items' priority.
 */

import { prisma } from "@/lib/prisma";
import { calibrateCloseProbability } from "./calibration-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExpectedRevenueResult {
    expectedRevenue: number;  // BRL
    priorityWeight: number;   // 0–100 (percentile rank within pipeline)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Maps priorityWeight to ActionQueue priority label */
function weightToPriorityLabel(weight: number): string {
    if (weight >= 85) return "critical";
    if (weight >= 60) return "high";
    if (weight >= 30) return "medium";
    return "low";
}

/** Resolve potential revenue for a session from linked ROI projection or revenueScore */
async function resolvePotentialRevenue(session: any): Promise<number> {
    // Try ROI projection first (most accurate)
    if (session.assessmentId) {
        const roi = await (prisma as any).roiProjection.findFirst({
            where: { assessmentId: session.assessmentId },
            select: {
                operationalSavingsEstimate: true,
                revenueIncreaseEstimate: true,
                estimatedPaybackMonths: true,
            },
        });
        if (roi) {
            // Annualized benefit as potential revenue proxy
            const monthly = (roi.operationalSavingsEstimate ?? 0) + (roi.revenueIncreaseEstimate ?? 0);
            return monthly * 12;
        }
    }

    // Fall back to session's revenueScore (if set by scoring engine)
    if (session.revenueScore && session.revenueScore > 0) {
        return session.revenueScore;
    }

    // Default by tier
    const tierDefaults: Record<string, number> = {
        hot: 60000,
        warm: 24000,
        cold: 8000,
    };
    return tierDefaults[session.priorityTier ?? "warm"] ?? 24000;
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function calculateExpectedRevenue(
    meetingSessionId: string
): Promise<ExpectedRevenueResult> {
    // 1. Load session (including freshly calibrated probability)
    const session = await (prisma as any).meetingSession.findUnique({
        where: { id: meetingSessionId },
    });

    if (!session) {
        throw new Error(`MeetingSession not found: ${meetingSessionId}`);
    }

    // 2. Ensure we have an adjusted probability (run calibration if missing)
    let adjustedProbability: number = session.adjustedProbability;
    if (adjustedProbability == null) {
        const calibration = await calibrateCloseProbability(meetingSessionId);
        adjustedProbability = calibration.adjustedProbability;
    }

    // 3. Compute potential revenue
    const potentialRevenue = await resolvePotentialRevenue(session);

    // 4. Expected revenue formula
    const expectedRevenue = Math.round(potentialRevenue * adjustedProbability);

    // 5. Compute percentile rank against all ORG sessions with expectedRevenue
    const orgId: string = session.organizationId;
    const pipelineSessions = await (prisma as any).meetingSession.findMany({
        where: {
            organizationId: orgId,
            status: { not: "canceled" },
            expectedRevenue: { not: null },
        },
        select: { id: true, expectedRevenue: true },
        orderBy: { expectedRevenue: "asc" },
    });

    // Add the current session's value if it's not yet in pipeline
    const allValues: number[] = pipelineSessions.map((s: any) => s.expectedRevenue as number);

    // If this session is not yet persisted, include current expectedRevenue for ranking
    const alreadyInList = pipelineSessions.some((s: any) => s.id === meetingSessionId);
    if (!alreadyInList) {
        allValues.push(expectedRevenue);
        allValues.sort((a, b) => a - b);
    }

    // Percentile rank (0–100)
    let priorityWeight = 50; // fallback
    if (allValues.length > 0) {
        const rank = allValues.filter((v) => v <= expectedRevenue).length;
        priorityWeight = Math.round((rank / allValues.length) * 100);
    }

    // 6. Persist to MeetingSession
    await (prisma as any).meetingSession.update({
        where: { id: meetingSessionId },
        data: { expectedRevenue },
    });

    // 7. Update related ActionQueue items' priority
    const newPriorityLabel = weightToPriorityLabel(priorityWeight);
    await (prisma as any).actionQueue.updateMany({
        where: {
            organizationId: orgId,
            relatedEntityType: "meeting_session",
            relatedEntityId: meetingSessionId,
            status: "pending",
        },
        data: { priority: newPriorityLabel },
    });

    return {
        expectedRevenue,
        priorityWeight,
    };
}
