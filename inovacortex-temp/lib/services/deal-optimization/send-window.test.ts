import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    getBestSendHour,
    recommendSendAt,
    logProposalSent,
    logProposalWon,
} from "./send-window";

// ─── Mock prisma ──────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
    prisma: {
        sendWindowStat: {
            findMany: (...args: any[]) => mockFindMany(...args),
            findUnique: (...args: any[]) => mockFindUnique(...args),
            upsert: (...args: any[]) => mockUpsert(...args),
        },
    },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStats(data: Array<{ hourBucket: number; sentCount: number; wonCount: number }>) {
    return data;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("send-window engine", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpsert.mockResolvedValue({});
        mockFindUnique.mockResolvedValue(null);
    });

    describe("getBestSendHour — no data", () => {
        it("returns fallback when no stats exist", async () => {
            mockFindMany.mockResolvedValue([]);
            const result = await getBestSendHour("org-1");
            expect(result.fallback).toBe(true);
            expect(result.hasSufficientData).toBe(false);
            expect(result.hour).toBe(10); // FALLBACK_HOURS[0]
        });

        it("returns fallback when sentCount < MIN_SAMPLES for all buckets", async () => {
            mockFindMany.mockResolvedValue(makeStats([
                { hourBucket: 9, sentCount: 3, wonCount: 2 },
                { hourBucket: 14, sentCount: 4, wonCount: 3 },
            ]));
            const result = await getBestSendHour("org-1");
            expect(result.fallback).toBe(true);
        });
    });

    describe("getBestSendHour — with sufficient data", () => {
        it("picks the bucket with the highest win rate", async () => {
            mockFindMany.mockResolvedValue(makeStats([
                { hourBucket: 9, sentCount: 10, wonCount: 3 }, // 30%
                { hourBucket: 10, sentCount: 10, wonCount: 7 }, // 70% ← winner
                { hourBucket: 14, sentCount: 10, wonCount: 5 }, // 50%
            ]));
            const result = await getBestSendHour("org-1");
            expect(result.hour).toBe(10);
            expect(result.winRate).toBeCloseTo(0.7);
            expect(result.hasSufficientData).toBe(true);
            expect(result.fallback).toBe(false);
        });

        it("breaks win-rate ties by preferring business hours", async () => {
            mockFindMany.mockResolvedValue(makeStats([
                { hourBucket: 22, sentCount: 10, wonCount: 5 }, // 50% — late night
                { hourBucket: 10, sentCount: 10, wonCount: 5 }, // 50% — business hour ← should win
            ]));
            const result = await getBestSendHour("org-1");
            expect(result.hour).toBe(10);
        });

        it("ignores buckets below MIN_SAMPLES even if win-rate is high", async () => {
            mockFindMany.mockResolvedValue(makeStats([
                { hourBucket: 8, sentCount: 2, wonCount: 2 }, // 100% but only 2 samples
                { hourBucket: 10, sentCount: 5, wonCount: 3 }, // 60% but qualifies
            ]));
            const result = await getBestSendHour("org-1");
            expect(result.hour).toBe(10); // 8 ignored
        });
    });

    describe("recommendSendAt", () => {
        it("returns a future date when best hour is ahead today", async () => {
            // Simulate: current local hour = 9, best hour = 14
            const now = new Date();
            // Force now to be 9:00 UTC → 6:00 BR local → best hour 14 is still ahead
            now.setUTCHours(12, 0, 0, 0); // 12 UTC = 9 BRT

            mockFindMany.mockResolvedValue(makeStats([
                { hourBucket: 14, sentCount: 10, wonCount: 8 }, // best
            ]));

            const result = await recommendSendAt("org-1", now);
            expect(result.recommendedAt > now).toBe(true);
            expect(result.bestHour).toBe(14);
        });

        it("schedules tomorrow when best hour already passed", async () => {
            // Force now to 20:00 UTC = 17:00 BRT, best hour = 10 (already passed)
            const now = new Date();
            now.setUTCHours(23, 0, 0, 0); // 23 UTC = 20 BRT

            mockFindMany.mockResolvedValue(makeStats([
                { hourBucket: 10, sentCount: 5, wonCount: 4 },
            ]));

            const result = await recommendSendAt("org-1", now);
            const diffMs = result.recommendedAt.getTime() - now.getTime();
            // Should be scheduled tomorrow — at least a few hours from now
            expect(diffMs).toBeGreaterThan(60 * 60 * 1000);
            expect(result.bestHour).toBe(10);
        });
    });

    describe("logProposalSent / logProposalWon", () => {
        it("upserts sentCount increment", async () => {
            await logProposalSent("org-1", new Date("2026-01-01T13:00:00Z")); // 13 UTC = 10 BRT
            expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
                where: { orgId_hourBucket: { orgId: "org-1", hourBucket: 10 } },
                update: expect.objectContaining({ sentCount: { increment: 1 } }),
            }));
        });

        it("upserts wonCount increment", async () => {
            await logProposalWon("org-1", 14);
            expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
                where: { orgId_hourBucket: { orgId: "org-1", hourBucket: 14 } },
                update: expect.objectContaining({ wonCount: { increment: 1 } }),
            }));
        });

        it("clamps hourBucket from logProposalWon to 0-23", async () => {
            await logProposalWon("org-1", 25); // out of range
            expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
                where: { orgId_hourBucket: { orgId: "org-1", hourBucket: 23 } },
            }));
        });
    });
});
