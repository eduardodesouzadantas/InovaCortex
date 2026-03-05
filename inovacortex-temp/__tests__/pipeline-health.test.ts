/**
 * __tests__/pipeline-health.test.ts
 * V17: Tests for calculatePipelineHealth()
 */

jest.mock("@/lib/prisma", () => ({
    prisma: {
        meetingSession: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
        meetingPerformance: {
            groupBy: jest.fn(),
        },
        proposal: {
            count: jest.fn(),
        },
    },
}));

import { calculatePipelineHealth } from "@/lib/pipeline-health";
import { prisma } from "@/lib/prisma";

const mockSessionFindMany = (prisma as any).meetingSession.findMany as jest.MockedFunction<any>;
const mockSessionCount = (prisma as any).meetingSession.count as jest.MockedFunction<any>;
const mockPerfGroupBy = (prisma as any).meetingPerformance.groupBy as jest.MockedFunction<any>;
const mockProposalCount = (prisma as any).proposal.count as jest.MockedFunction<any>;

function setupDefaults() {
    mockSessionFindMany.mockResolvedValue([]);
    mockSessionCount.mockResolvedValue(0);
    mockPerfGroupBy.mockResolvedValue([]);
    mockProposalCount.mockResolvedValue(0);
}

beforeEach(() => {
    jest.clearAllMocks();
    setupDefaults();
});

describe("calculatePipelineHealth", () => {
    it("returns zero-state when pipeline is empty", async () => {
        const result = await calculatePipelineHealth("org-1");
        expect(result.weightedPipelineValue).toBe(0);
        expect(result.avgProbability).toBe(0);
        expect(result.projectedRevenue30d).toBe(0);
        expect(result.activeSessions).toBe(0);
        expect(result.pipelineQualityIndex).toBeGreaterThanOrEqual(0);
        expect(result.pipelineQualityIndex).toBeLessThanOrEqual(100);
    });

    it("weightedPipelineValue = sum of expectedRevenue", async () => {
        mockSessionFindMany.mockResolvedValue([
            { id: "s1", expectedRevenue: 20000, adjustedProbability: 0.60, startAt: new Date(Date.now() + 86400000) },
            { id: "s2", expectedRevenue: 15000, adjustedProbability: 0.45, startAt: new Date(Date.now() + 86400000) },
            { id: "s3", expectedRevenue: 5000, adjustedProbability: 0.30, startAt: new Date(Date.now() + 86400000) },
        ]);
        mockPerfGroupBy.mockResolvedValue([]);
        mockSessionCount.mockResolvedValue(3);
        mockProposalCount.mockResolvedValue(0);

        const result = await calculatePipelineHealth("org-1");
        expect(result.weightedPipelineValue).toBe(40000);
    });

    it("avgProbability is correct mean", async () => {
        mockSessionFindMany.mockResolvedValue([
            { id: "s1", expectedRevenue: 10000, adjustedProbability: 0.60, startAt: new Date(Date.now() - 86400000) },
            { id: "s2", expectedRevenue: 10000, adjustedProbability: 0.40, startAt: new Date(Date.now() - 86400000) },
        ]);
        mockSessionCount.mockResolvedValue(0);
        mockPerfGroupBy.mockResolvedValue([]);
        mockProposalCount.mockResolvedValue(0);

        const result = await calculatePipelineHealth("org-1");
        expect(result.avgProbability).toBeCloseTo(0.50, 2);
    });

    it("closeRate30d reflects won/(won+lost)", async () => {
        mockPerfGroupBy.mockResolvedValue([
            { outcome: "won", _count: { _all: 7 } },
            { outcome: "lost", _count: { _all: 3 } },
        ]);
        mockSessionCount.mockResolvedValue(0);
        mockProposalCount.mockResolvedValue(0);

        const result = await calculatePipelineHealth("org-1");
        expect(result.closeRate30d).toBeCloseTo(0.70, 2);
    });

    it("pipelineQualityIndex is always 0–100", async () => {
        // Worst case: 0 wins, many stalls, no volume
        mockPerfGroupBy.mockResolvedValue([]);
        mockProposalCount.mockResolvedValue(20); // many stalled
        mockSessionFindMany.mockResolvedValue([]);
        mockSessionCount.mockResolvedValue(0);

        const worst = await calculatePipelineHealth("org-1");
        expect(worst.pipelineQualityIndex).toBeGreaterThanOrEqual(0);
        expect(worst.pipelineQualityIndex).toBeLessThanOrEqual(100);

        // Best case: 100% win rate, full pipeline, no stalls
        mockPerfGroupBy.mockResolvedValue([
            { outcome: "won", _count: { _all: 50 } },
        ]);
        mockProposalCount.mockResolvedValue(0);
        mockSessionFindMany.mockResolvedValue(
            Array.from({ length: 15 }, (_, i) => ({
                id: `s${i}`, expectedRevenue: 30000, adjustedProbability: 0.85,
                startAt: new Date(Date.now() + 86400000),
            }))
        );
        mockSessionCount.mockResolvedValue(15);

        const best = await calculatePipelineHealth("org-1");
        expect(best.pipelineQualityIndex).toBeLessThanOrEqual(100);
        expect(best.pipelineQualityIndex).toBeGreaterThanOrEqual(0);
        expect(best.pipelineQualityIndex).toBeGreaterThan(worst.pipelineQualityIndex);
    });

    it("stalled proposals degrade pipelineQualityIndex", async () => {
        const baseData = {
            sessions: [
                { id: "s1", expectedRevenue: 20000, adjustedProbability: 0.60, startAt: new Date(Date.now() + 86400000) },
            ],
            performance: [{ outcome: "won", _count: { _all: 5 } }, { outcome: "lost", _count: { _all: 5 } }],
        };

        // With 0 stalls
        mockSessionFindMany.mockResolvedValue(baseData.sessions);
        mockPerfGroupBy.mockResolvedValue(baseData.performance);
        mockSessionCount.mockResolvedValue(1);
        mockProposalCount.mockResolvedValue(0);
        const noStalls = await calculatePipelineHealth("org-1");

        // With 5 stalls
        mockSessionFindMany.mockResolvedValue(baseData.sessions);
        mockPerfGroupBy.mockResolvedValue(baseData.performance);
        mockSessionCount.mockResolvedValue(1);
        mockProposalCount.mockResolvedValue(5);
        const withStalls = await calculatePipelineHealth("org-1");

        expect(withStalls.pipelineQualityIndex).toBeLessThanOrEqual(noStalls.pipelineQualityIndex);
    });

    it("projectedRevenue30d only counts sessions starting within 30 days", async () => {
        const now = Date.now();
        mockSessionFindMany.mockResolvedValue([
            // Within 30d
            { id: "s1", expectedRevenue: 20000, adjustedProbability: 0.60, startAt: new Date(now + 10 * 86400000) },
            // Beyond 30d
            { id: "s2", expectedRevenue: 50000, adjustedProbability: 0.70, startAt: new Date(now + 60 * 86400000) },
            // In the past
            { id: "s3", expectedRevenue: 10000, adjustedProbability: 0.50, startAt: new Date(now - 86400000) },
        ]);
        mockPerfGroupBy.mockResolvedValue([]);
        mockSessionCount.mockResolvedValue(2);
        mockProposalCount.mockResolvedValue(0);

        const result = await calculatePipelineHealth("org-1");
        expect(result.projectedRevenue30d).toBe(20000);
    });
});
