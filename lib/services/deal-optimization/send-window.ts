/**
 * lib/services/deal-optimization/send-window.ts
 * V17 P3/P3: Send-window optimization engine.
 *
 * Two responsibilities:
 *  1. getBestSendHour(orgId) — derive the historically best hour to send a
 *     proposal based on `SendWindowStat` win-rate per hourBucket.
 *     Falls back to 10h–12h if not enough data (sentCount < 5).
 *
 *  2. recommendSendAt(orgId, now?) — return the absolute Date when to schedule
 *     the next proposal send:
 *       - If the best hour is still ahead today → today at bestHour
 *       - If it already passed            → tomorrow at bestHour
 *
 * Logging helpers (called from executor / outcome webhook):
 *  - logProposalSent(orgId, sentAt)   → increments sentCount for that hourBucket
 *  - logProposalWon(orgId, sentHour)  → increments wonCount for that hourBucket
 */

import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendWindowResult {
    bestHour: number;           // 0–23
    winRate: number;            // [0, 1]  — NaN when insufficient data
    hasSufficientData: boolean; // sentCount >= MIN_SAMPLES for winner bucket
    recommendedAt: Date;        // absolute scheduled time
    fallback: boolean;          // true when using default hours
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum sends in a bucket before we trust its win-rate. */
const MIN_SAMPLES = 5;

/**
 * Default "best" hours used when there is not enough historical data.
 * Ordered by priority (first = preferred).
 */
const FALLBACK_HOURS = [10, 11, 14, 15, 9];

// ─── Core Engine ─────────────────────────────────────────────────────────────

/**
 * Compute the best hourBucket to send a proposal for a given org.
 * Only considers buckets with >= MIN_SAMPLES sends.
 * Returns the fallback hour when no bucket qualifies.
 */
export async function getBestSendHour(orgId: string): Promise<{
    hour: number;
    winRate: number;
    hasSufficientData: boolean;
    fallback: boolean;
}> {
    const stats: Array<{ hourBucket: number; sentCount: number; wonCount: number }> =
        await (prisma as any).sendWindowStat.findMany({
            where: { orgId },
            orderBy: { hourBucket: "asc" },
        });

    // Filter to buckets with enough data
    const qualified = stats.filter(s => s.sentCount >= MIN_SAMPLES);

    if (qualified.length === 0) {
        return { hour: FALLBACK_HOURS[0], winRate: NaN, hasSufficientData: false, fallback: true };
    }

    // Pick bucket with highest win rate; break ties by preferring earlier business hours
    let best = qualified[0];
    for (const s of qualified) {
        const rateS = s.wonCount / s.sentCount;
        const rateBest = best.wonCount / best.sentCount;
        if (rateS > rateBest) {
            best = s;
        } else if (rateS === rateBest && isBusinessHour(s.hourBucket) && !isBusinessHour(best.hourBucket)) {
            best = s;
        }
    }

    return {
        hour: best.hourBucket,
        winRate: best.wonCount / best.sentCount,
        hasSufficientData: true,
        fallback: false,
    };
}

/**
 * Returns the recommended absolute datetime to send a proposal.
 * Respects local Brazilian business hours (UTC-3 approximation via env offset).
 */
export async function recommendSendAt(orgId: string, now: Date = new Date()): Promise<SendWindowResult> {
    const { hour, winRate, hasSufficientData, fallback } = await getBestSendHour(orgId);

    const scheduledDate = nextOccurrenceOfHour(now, hour);

    return {
        bestHour: hour,
        winRate,
        hasSufficientData,
        recommendedAt: scheduledDate,
        fallback,
    };
}

// ─── Logging helpers ──────────────────────────────────────────────────────────

/**
 * Call this right after a proposal is marked "sent".
 * Increments sentCount for the hourBucket matching sentAt's local hour (UTC-3).
 */
export async function logProposalSent(orgId: string, sentAt: Date = new Date()): Promise<void> {
    const hourBucket = toLocalHour(sentAt);
    await upsertBucket(orgId, hourBucket, { sentCount: { increment: 1 } });
}

/**
 * Call this when a proposal outcome is "won" and you know what hour it was sent.
 * If sentHour is unknown, pass the winning proposal's createdAt hour as a proxy.
 */
export async function logProposalWon(orgId: string, sentHour: number): Promise<void> {
    const bucket = Math.max(0, Math.min(23, sentHour));
    await upsertBucket(orgId, bucket, { wonCount: { increment: 1 } });
}

/**
 * Convenience: given a proposal that was just marked won,
 * derive the sentHour from the proposal's updatedAt timestamp.
 */
export async function logProposalWonFromProposalId(orgId: string, proposalId: string): Promise<void> {
    const proposal = await (prisma as any).proposal.findUnique({
        where: { id: proposalId },
        select: { createdAt: true },   // createdAt is the best proxy for "when sent"
    });
    if (!proposal) return;
    const sentHour = toLocalHour(new Date(proposal.createdAt));
    await logProposalWon(orgId, sentHour);
}

// ─── Upsert helper ────────────────────────────────────────────────────────────

async function upsertBucket(
    orgId: string,
    hourBucket: number,
    increment: { sentCount?: { increment: number }; wonCount?: { increment: number } },
): Promise<void> {
    await (prisma as any).sendWindowStat.upsert({
        where: { orgId_hourBucket: { orgId, hourBucket } },
        create: {
            orgId,
            hourBucket,
            sentCount: increment.sentCount?.increment ?? 0,
            wonCount: increment.wonCount?.increment ?? 0,
        },
        update: increment,
    });
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Convert UTC Date to Brazil local hour (UTC-3). */
function toLocalHour(d: Date): number {
    return (d.getUTCHours() + 21) % 24; // +21 = -3 mod 24
}

/**
 * Return the next Date that falls on `hour` local time (UTC-3).
 * If that hour is still ahead today (local), use today; otherwise tomorrow.
 */
function nextOccurrenceOfHour(now: Date, hour: number): Date {
    const localNowHour = toLocalHour(now);

    const candidate = new Date(now);

    if (localNowHour < hour) {
        // Still ahead today — set to today at `hour`
        candidate.setUTCHours(hour + 3, 0, 0, 0); // convert back to UTC
    } else {
        // Already passed — schedule tomorrow
        candidate.setUTCDate(candidate.getUTCDate() + 1);
        candidate.setUTCHours(hour + 3, 0, 0, 0);
    }

    return candidate;
}

/** Returns true for typical Brazilian business hours (09h–18h). */
function isBusinessHour(hour: number): boolean {
    return hour >= 9 && hour <= 18;
}
