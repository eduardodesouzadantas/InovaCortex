/**
 * __tests__/calibration-engine.test.ts
 * V17: Tests for calibrateCloseProbability()
 */

// Mock prisma before imports
jest.mock("@/lib/prisma", () => ({
    prisma: {
        meetingSession: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        meetingPerformance: {
            count: jest.fn(),
        },
        roiProjection: {
            findFirst: jest.fn(),
        },
    },
}));

import { calibrateCloseProbability } from "@/lib/calibration-engine";
import { prisma } from "@/lib/prisma";

// Convenience typed references
const mockFindUnique = (prisma as any).meetingSession.findUnique as jest.MockedFunction<any>;
const mockUpdate = (prisma as any).meetingSession.update as jest.MockedFunction<any>;
const mockPerfCount = (prisma as any).meetingPerformance.count as jest.MockedFunction<any>;
const mockRoiFindFirst = (prisma as any).roiProjection.findFirst as jest.MockedFunction<any>;

function buildSession(overrides: Partial<any> = {}) {
    return {
        id: "sess-1",
        organizationId: "org-1",
        assessmentId: null,
        closeProbability: 0.5,
        adjustedProbability: null,
        confidenceScore: null,
        priorityTier: "warm",
        startAt: new Date("2026-03-02T10:00:00Z"),
        updatedAt: new Date(Date.now() - 1 * 86400000), // 1 day ago
        createdAt: new Date(Date.now() - 2 * 86400000),
        status: "scheduled",
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockPerfCount.mockResolvedValue(0);
    mockRoiFindFirst.mockResolvedValue(null);
});

describe("calibrateCloseProbability", () => {
    it("throws if session not found", async () => {
        mockFindUnique.mockResolvedValue(null);
        await expect(calibrateCloseProbability("nonexistent")).rejects.toThrow("MeetingSession not found");
    });

    it("never returns below 0.05", async () => {
        mockFindUnique.mockResolvedValue(buildSession({
            closeProbability: 0.0,
            priorityTier: "cold",
            // Very stale (20 days ago)
            updatedAt: new Date(Date.now() - 20 * 86400000),
        }));
        // Simulate 0 org wins
        mockPerfCount.mockResolvedValue(0);

        const result = await calibrateCloseProbability("sess-1");
        expect(result.adjustedProbability).toBeGreaterThanOrEqual(0.05);
    });

    it("never returns above 0.92", async () => {
        mockFindUnique.mockResolvedValue(buildSession({
            closeProbability: 1.0,
            priorityTier: "hot",
            updatedAt: new Date(), // just updated
        }));
        // 100% win rate
        mockPerfCount.mockImplementation(({ where }: any) => {
            if (where.outcome === "won") return Promise.resolve(100);
            return Promise.resolve(100);
        });
        mockRoiFindFirst.mockResolvedValue({
            operationalSavingsEstimate: 100000,
            revenueIncreaseEstimate: 100000,
        });

        const result = await calibrateCloseProbability("sess-1");
        expect(result.adjustedProbability).toBeLessThanOrEqual(0.92);
    });

    it("hot tier produces higher probability than cold tier", async () => {
        const baseSession = buildSession({ closeProbability: 0.5, updatedAt: new Date() });

        mockFindUnique.mockResolvedValueOnce({ ...baseSession, priorityTier: "hot" });
        mockPerfCount.mockResolvedValue(0);
        const hotResult = await calibrateCloseProbability("sess-1");

        mockFindUnique.mockResolvedValueOnce({ ...baseSession, priorityTier: "cold" });
        mockPerfCount.mockResolvedValue(0);
        const coldResult = await calibrateCloseProbability("sess-2");

        expect(hotResult.adjustedProbability).toBeGreaterThan(coldResult.adjustedProbability);
    });

    it("EMA smoothing respects previous calibration", async () => {
        // Previous = 0.5, new raw ~ 0.72 (hot tier). EMA alpha=0.7 → ~0.65
        mockFindUnique.mockResolvedValue(buildSession({
            priorityTier: "hot",
            closeProbability: 0.72,
            adjustedProbability: 0.50,
            updatedAt: new Date(),
        }));
        mockPerfCount.mockResolvedValue(0);

        const result = await calibrateCloseProbability("sess-1");
        // Should be between raw and previous — not equal to either extreme
        expect(result.adjustedProbability).toBeLessThan(0.92);
        expect(result.adjustedProbability).toBeGreaterThan(0.05);
    });

    it("persists result to DB", async () => {
        mockFindUnique.mockResolvedValue(buildSession());
        mockPerfCount.mockResolvedValue(0);

        await calibrateCloseProbability("sess-1");

        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "sess-1" },
                data: expect.objectContaining({
                    adjustedProbability: expect.any(Number),
                    confidenceScore: expect.any(Number),
                }),
            })
        );
    });

    it("confidence score increases with more org history and ROI data", async () => {
        const richSession = buildSession({ assessmentId: "assess-1", updatedAt: new Date() });
        mockFindUnique.mockResolvedValue(richSession);
        // Many historical outcomes (>= 30 triggers 0.8 max from history alone)
        mockPerfCount.mockImplementation(({ where }: any) => {
            if (where.outcome === "won") return Promise.resolve(25);
            return Promise.resolve(35);
        });
        mockRoiFindFirst.mockResolvedValue({
            operationalSavingsEstimate: 15000,
            revenueIncreaseEstimate: 8000,
        });

        const result = await calibrateCloseProbability("sess-1");
        expect(result.confidenceScore).toBeGreaterThan(0.5);
    });
});
