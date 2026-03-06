/**
 * lib/services/revenue/expected-revenue.ts
 * V17: Calculates expectedRevenue and priorityWeight for a MeetingSession.
 *
 * expectedRevenue = potentialRevenue * adjustedProbability
 * priorityWeight  = percentile rank of expectedRevenue within active pipeline
 */

import { prisma } from "@/lib/prisma";
import { calibrateCloseProbability } from "./calibration-engine";

export interface ExpectedRevenueResult {
    expectedRevenue: number;
    priorityWeight: number;  // 0–100
    adjustedProbability: number;
    confidenceScore: number;
}

/**
 * Calculate expected revenue for a single session and persist results.
 * Also returns priorityWeight relative to current org pipeline.
 */
export async function calculateExpectedRevenue(meetingSessionId: string): Promise<ExpectedRevenueResult> {
    const session = await (prisma as any).meetingSession.findUnique({
        where: { id: meetingSessionId }
    });
    if (!session) {
        return { expectedRevenue: 0, priorityWeight: 0, adjustedProbability: 0.05, confidenceScore: 0.1 };
    }

    // 1. Calibrate probability
    const cal = await calibrateCloseProbability(meetingSessionId);

    // 2. Compute expected revenue
    const potentialRevenue = session.revenueScore ?? 0;
    const expectedRevenue = potentialRevenue * cal.adjustedProbability;

    // 3. Compute percentile rank against all active sessions in org
    const allActive = await (prisma as any).meetingSession.findMany({
        where: {
            organizationId: session.organizationId,
            status: { in: ["scheduled", "completed"] },
            expectedRevenue: { not: null }
        },
        select: { expectedRevenue: true }
    });

    const allValues = allActive.map((s: any) => s.expectedRevenue as number).filter((v: number) => v > 0);
    allValues.push(expectedRevenue); // include self

    allValues.sort((a: number, b: number) => a - b);
    const rank = allValues.indexOf(expectedRevenue);
    const priorityWeight = allValues.length > 1
        ? Math.round((rank / (allValues.length - 1)) * 100)
        : 50;

    // 4. Persist back to MeetingSession
    await (prisma as any).meetingSession.update({
        where: { id: meetingSessionId },
        data: {
            adjustedProbability: cal.adjustedProbability,
            confidenceScore: cal.confidenceScore,
            expectedRevenue,
        }
    });

    return {
        expectedRevenue: Math.round(expectedRevenue * 100) / 100,
        priorityWeight,
        adjustedProbability: cal.adjustedProbability,
        confidenceScore: cal.confidenceScore,
    };
}

/**
 * Bulk recalculate all active sessions for an org.
 * Returns sorted list by priorityWeight DESC.
 */
export async function recalculateAllExpectedRevenue(orgId: string): Promise<Array<{ sessionId: string } & ExpectedRevenueResult>> {
    const sessions = await (prisma as any).meetingSession.findMany({
        where: { organizationId: orgId, status: { in: ["scheduled", "completed"] } },
        select: { id: true }
    });

    const results = await Promise.all(
        sessions.map(async (s: any) => {
            const result = await calculateExpectedRevenue(s.id);
            return { sessionId: s.id, ...result };
        })
    );

    return results.sort((a, b) => b.priorityWeight - a.priorityWeight);
}
