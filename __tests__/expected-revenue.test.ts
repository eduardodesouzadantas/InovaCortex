/**
 * __tests__/expected-revenue.test.ts
 * V17: Tests for calculateExpectedRevenue()
 */

jest.mock("@/lib/prisma", () => ({
    prisma: {
        meetingSession: {
            findUnique: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
        },
        roiProjection: {
            findFirst: jest.fn(),
        },
        actionQueue: {
            updateMany: jest.fn(),
        },
    },
}));

// calibration-engine is a dependency — mock it so tests are isolated
jest.mock("@/lib/calibration-engine", () => ({
    calibrateCloseProbability: jest.fn().mockResolvedValue({
        adjustedProbability: 0.55,
        confidenceScore: 0.7,
    }),
}));

import { calculateExpectedRevenue } from "@/lib/expected-revenue";
import { prisma } from "@/lib/prisma";

const mockSessionFindUnique = (prisma as any).meetingSession.findUnique as jest.MockedFunction<any>;
const mockSessionUpdate = (prisma as any).meetingSession.update as jest.MockedFunction<any>;
const mockSessionFindMany = (prisma as any).meetingSession.findMany as jest.MockedFunction<any>;
const mockRoiFindFirst = (prisma as any).roiProjection.findFirst as jest.MockedFunction<any>;
const mockQueueUpdateMany = (prisma as any).actionQueue.updateMany as jest.MockedFunction<any>;

function buildSession(overrides: Partial<any> = {}) {
    return {
        id: "sess-1",
        organizationId: "org-1",
        assessmentId: null,
        adjustedProbability: 0.60,
        revenueScore: 0,
        priorityTier: "warm",
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockSessionUpdate.mockResolvedValue({});
    mockQueueUpdateMany.mockResolvedValue({ count: 0 });
    mockSessionFindMany.mockResolvedValue([]);
    mockRoiFindFirst.mockResolvedValue(null);
});

describe("calculateExpectedRevenue", () => {
    it("throws if session not found", async () => {
        mockSessionFindUnique.mockResolvedValue(null);
        await expect(calculateExpectedRevenue("nonexistent")).rejects.toThrow("MeetingSession not found");
    });

    it("computes expectedRevenue = potentialRevenue × adjustedProbability", async () => {
        // Probability = 0.60, tier=warm → fallback = 24000 BRL/year
        mockSessionFindUnique.mockResolvedValue(buildSession({ adjustedProbability: 0.60, revenueScore: 0 }));
        mockSessionFindMany.mockResolvedValue([]);

        const result = await calculateExpectedRevenue("sess-1");
        // 24000 × 0.60 = 14400
        expect(result.expectedRevenue).toBe(14400);
    });

    it("uses ROI projection when available", async () => {
        mockSessionFindUnique.mockResolvedValue(buildSession({
            adjustedProbability: 0.50,
            assessmentId: "assess-1",
        }));
        mockRoiFindFirst.mockResolvedValue({
            operationalSavingsEstimate: 20000,
            revenueIncreaseEstimate: 10000,
            estimatedPaybackMonths: 6,
        });
        mockSessionFindMany.mockResolvedValue([]);

        const result = await calculateExpectedRevenue("sess-1");
        // Annual = (20000+10000) × 12 = 360000 × 0.50 = 180000
        expect(result.expectedRevenue).toBe(180000);
    });

    it("hot tier has higher default potential than cold tier", async () => {
        mockSessionFindUnique.mockResolvedValueOnce(buildSession({ adjustedProbability: 0.50, priorityTier: "hot" }));
        mockSessionFindMany.mockResolvedValue([]);
        const hotResult = await calculateExpectedRevenue("sess-1");

        mockSessionFindUnique.mockResolvedValueOnce(buildSession({ adjustedProbability: 0.50, priorityTier: "cold" }));
        mockSessionFindMany.mockResolvedValue([]);
        const coldResult = await calculateExpectedRevenue("sess-2");

        expect(hotResult.expectedRevenue).toBeGreaterThan(coldResult.expectedRevenue);
    });

    it("priorityWeight is 0–100", async () => {
        mockSessionFindUnique.mockResolvedValue(buildSession({ adjustedProbability: 0.60 }));
        mockSessionFindMany.mockResolvedValue([
            { id: "other-1", expectedRevenue: 5000 },
            { id: "other-2", expectedRevenue: 10000 },
            { id: "other-3", expectedRevenue: 30000 },
        ]);

        const result = await calculateExpectedRevenue("sess-1");
        expect(result.priorityWeight).toBeGreaterThanOrEqual(0);
        expect(result.priorityWeight).toBeLessThanOrEqual(100);
    });

    it("higher expectedRevenue → higher priorityWeight", async () => {
        const pipelineSessions = [
            { id: "a", expectedRevenue: 5000 },
            { id: "b", expectedRevenue: 10000 },
            { id: "c", expectedRevenue: 15000 },
            { id: "d", expectedRevenue: 20000 },
        ];

        // Low value session
        mockSessionFindUnique.mockResolvedValueOnce(buildSession({ adjustedProbability: 0.10, priorityTier: "cold" }));
        mockSessionFindMany.mockResolvedValueOnce(pipelineSessions);
        const lowResult = await calculateExpectedRevenue("sess-low");

        // High value session
        mockSessionFindUnique.mockResolvedValueOnce(buildSession({ adjustedProbability: 0.80, priorityTier: "hot" }));
        mockSessionFindMany.mockResolvedValueOnce(pipelineSessions);
        const highResult = await calculateExpectedRevenue("sess-high");

        expect(highResult.priorityWeight).toBeGreaterThanOrEqual(lowResult.priorityWeight);
    });

    it("persists expectedRevenue to DB", async () => {
        mockSessionFindUnique.mockResolvedValue(buildSession({ adjustedProbability: 0.50 }));
        mockSessionFindMany.mockResolvedValue([]);

        await calculateExpectedRevenue("sess-1");

        expect(mockSessionUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "sess-1" },
                data: expect.objectContaining({ expectedRevenue: expect.any(Number) }),
            })
        );
    });

    it("updates ActionQueue priority based on weight", async () => {
        mockSessionFindUnique.mockResolvedValue(buildSession({ adjustedProbability: 0.90, priorityTier: "hot" }));
        // High value session alone in pipeline = 100th percentile = critical
        mockSessionFindMany.mockResolvedValue([]);

        await calculateExpectedRevenue("sess-1");

        expect(mockQueueUpdateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ priority: expect.stringMatching(/critical|high|medium|low/) }),
            })
        );
    });
});
