import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Prisma before importing the module ──────────────────────────────────

vi.mock("@/lib/prisma", () => ({
    prisma: {
        billingRecord: {
            aggregate: vi.fn(),
        },
        meetingSession: {
            aggregate: vi.fn(),
        },
        proposal: {
            groupBy: vi.fn(),
        },
        profitLeak: {
            aggregate: vi.fn(),
        },
        clientWorkspace: {
            count: vi.fn(),
        },
        assessment: {
            count: vi.fn(),
        },
    },
}));

import { getLiveKPIs } from "@/lib/kpi-engine";
import { prisma } from "@/lib/prisma";

// ─── Helper: set up clean mocks for "empty DB" ───────────────────────────────

function mockEmpty() {
    (prisma as any).billingRecord.aggregate.mockResolvedValue({ _sum: { amountCents: null }, _count: { id: 0 } });
    (prisma as any).meetingSession.aggregate.mockResolvedValue({ _sum: { expectedRevenue: null } });
    (prisma as any).proposal.groupBy.mockResolvedValue([]);
    (prisma as any).profitLeak.aggregate.mockResolvedValue({ _sum: { estimatedLossCents: null } });
    (prisma as any).clientWorkspace.count.mockResolvedValue(0);
    (prisma as any).assessment.count.mockResolvedValue(0);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("kpi-engine — getLiveKPIs", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockEmpty();
    });

    it("returns all zeros when DB is empty", async () => {
        const kpis = await getLiveKPIs("org-test");
        expect(kpis.monthlyRevenueCents).toBe(0);
        expect(kpis.pipelineValueCents).toBe(0);
        expect(kpis.conversionRate).toBe(0);
        expect(kpis.averageDealSizeCents).toBe(0);
        expect(kpis.lostRevenueCents).toBe(0);
        expect(kpis.proposalAcceptanceRate).toBe(0);
        expect(kpis.activeWorkspaces).toBe(0);
    });

    it("monthlyRevenueCents comes from billingRecord aggregate", async () => {
        (prisma as any).billingRecord.aggregate.mockResolvedValue({ _sum: { amountCents: 500000 }, _count: { id: 2 } });
        (prisma as any).assessment.count.mockResolvedValue(10);

        const kpis = await getLiveKPIs("org-test");
        expect(kpis.monthlyRevenueCents).toBe(500000);
    });

    it("averageDealSizeCents = monthlyRevenueCents / closedCount", async () => {
        // 300000 / 3 = 100000
        (prisma as any).billingRecord.aggregate.mockResolvedValue({ _sum: { amountCents: 300000 }, _count: { id: 3 } });
        const kpis = await getLiveKPIs("org-test");
        expect(kpis.averageDealSizeCents).toBe(100000);
    });

    it("averageDealSizeCents is 0 when no closed deals", async () => {
        (prisma as any).billingRecord.aggregate.mockResolvedValue({ _sum: { amountCents: 0 }, _count: { id: 0 } });
        const kpis = await getLiveKPIs("org-test");
        expect(kpis.averageDealSizeCents).toBe(0);
    });

    it("pipelineValueCents converts expectedRevenue (float) × 100", async () => {
        // expectedRevenue is stored in BRL (not cents) in meetingSession
        (prisma as any).meetingSession.aggregate.mockResolvedValue({ _sum: { expectedRevenue: 15000 } });
        const kpis = await getLiveKPIs("org-test");
        expect(kpis.pipelineValueCents).toBe(1500000);
    });

    it("proposalAcceptanceRate = accepted / total proposals", async () => {
        (prisma as any).proposal.groupBy.mockResolvedValue([
            { status: "accepted", _count: { id: 3 } },
            { status: "sent", _count: { id: 7 } },
        ]);
        const kpis = await getLiveKPIs("org-test");
        expect(kpis.proposalAcceptanceRate).toBeCloseTo(0.3, 5);
    });

    it("proposalAcceptanceRate is 0 when no proposals", async () => {
        (prisma as any).proposal.groupBy.mockResolvedValue([]);
        const kpis = await getLiveKPIs("org-test");
        expect(kpis.proposalAcceptanceRate).toBe(0);
    });

    it("lostRevenueCents comes from profitLeak aggregate", async () => {
        (prisma as any).profitLeak.aggregate.mockResolvedValue({ _sum: { estimatedLossCents: 250000 } });
        const kpis = await getLiveKPIs("org-test");
        expect(kpis.lostRevenueCents).toBe(250000);
    });

    it("activeWorkspaces comes from clientWorkspace count", async () => {
        (prisma as any).clientWorkspace.count.mockResolvedValue(5);
        const kpis = await getLiveKPIs("org-test");
        expect(kpis.activeWorkspaces).toBe(5);
    });

    it("conversionRate = closed / total assessments", async () => {
        (prisma as any).billingRecord.aggregate.mockResolvedValue({ _sum: { amountCents: 100000 }, _count: { id: 4 } });
        (prisma as any).assessment.count.mockResolvedValue(20);
        const kpis = await getLiveKPIs("org-test");
        expect(kpis.conversionRate).toBeCloseTo(0.2, 5);
    });

    it("conversionRate is 0 when no assessments", async () => {
        (prisma as any).assessment.count.mockResolvedValue(0);
        const kpis = await getLiveKPIs("org-test");
        expect(kpis.conversionRate).toBe(0);
    });

    it("handles null aggregate sums gracefully (defaults to 0)", async () => {
        (prisma as any).billingRecord.aggregate.mockResolvedValue({ _sum: { amountCents: null }, _count: { id: 0 } });
        (prisma as any).profitLeak.aggregate.mockResolvedValue({ _sum: { estimatedLossCents: null } });
        (prisma as any).meetingSession.aggregate.mockResolvedValue({ _sum: { expectedRevenue: null } });
        const kpis = await getLiveKPIs("org-test");
        expect(kpis.monthlyRevenueCents).toBe(0);
        expect(kpis.lostRevenueCents).toBe(0);
        expect(kpis.pipelineValueCents).toBe(0);
    });

    it("returns a complete LiveKPIs object with all 7 keys", async () => {
        const kpis = await getLiveKPIs("org-test");
        const keys: (keyof typeof kpis)[] = [
            "monthlyRevenueCents", "pipelineValueCents", "conversionRate",
            "averageDealSizeCents", "lostRevenueCents", "proposalAcceptanceRate", "activeWorkspaces"
        ];
        for (const key of keys) {
            expect(kpis).toHaveProperty(key);
            expect(typeof kpis[key]).toBe("number");
        }
    });
});
