import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Prisma and system-events before import ──────────────────────────────

vi.mock("@/lib/prisma", () => ({
    prisma: {
        assessment: { findMany: vi.fn() },
        proposal: { findMany: vi.fn() },
        clientWorkspace: { findMany: vi.fn() },
        systemEvent: { findFirst: vi.fn() }, // accessed via (prisma as any).systemEvent
    },
}));

vi.mock("@/lib/system-events", () => ({
    logSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { runAnomalyDetectionSweep } from "@/lib/alert-engine";
import { prisma } from "@/lib/prisma";
import { logSystemEvent } from "@/lib/system-events";

// ─── Helper: mock "nothing stale" ────────────────────────────────────────────

function mockAllClear() {
    (prisma.assessment.findMany as any).mockResolvedValue([]);
    (prisma.proposal.findMany as any).mockResolvedValue([]);
    (prisma.clientWorkspace.findMany as any).mockResolvedValue([]);
    (prisma as any).systemEvent = { findFirst: vi.fn().mockResolvedValue(null) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("alert-engine — runAnomalyDetectionSweep", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockAllClear();
    });

    it("returns { message: 'Sweep complete' } when nothing is stale", async () => {
        const result = await runAnomalyDetectionSweep("org-test");
        expect(result).toEqual({ message: "Sweep complete" });
    });

    it("does NOT call logSystemEvent when DB is all clear", async () => {
        await runAnomalyDetectionSweep("org-test");
        expect(logSystemEvent).not.toHaveBeenCalled();
    });

    it("calls logSystemEvent once per stale lead not already alerted", async () => {
        const stale = [
            { id: "lead-1", name: "Alice", company: "Acme", status: "Novo" },
        ];
        (prisma.assessment.findMany as any).mockResolvedValue(stale);
        (prisma as any).systemEvent.findFirst.mockResolvedValue(null); // not alerted yet

        await runAnomalyDetectionSweep("org-test");

        expect(logSystemEvent).toHaveBeenCalledOnce();
        const call = (logSystemEvent as any).mock.calls[0][0];
        expect(call.type).toBe("profit_leak_detected");
        expect(call.entityType).toBe("Assessment");
        expect(call.entityId).toBe("lead-1");
    });

    it("does NOT re-alert a stale lead if systemEvent already exists", async () => {
        (prisma.assessment.findMany as any).mockResolvedValue([
            { id: "lead-1", name: "Alice", company: "Acme", status: "Novo" },
        ]);
        // Already alerted
        (prisma as any).systemEvent.findFirst.mockResolvedValue({ id: "evt-existing" });

        await runAnomalyDetectionSweep("org-test");
        expect(logSystemEvent).not.toHaveBeenCalled();
    });

    it("calls logSystemEvent for each of N stale leads (none previously alerted)", async () => {
        const staleLeads = [
            { id: "lead-1", name: "Alice", company: "A" },
            { id: "lead-2", name: "Bob", company: "B" },
            { id: "lead-3", name: "Carol", company: "C" },
        ];
        (prisma.assessment.findMany as any).mockResolvedValue(staleLeads);
        (prisma as any).systemEvent.findFirst.mockResolvedValue(null);

        await runAnomalyDetectionSweep("org-test");
        expect(logSystemEvent).toHaveBeenCalledTimes(3);
    });

    it("calls logSystemEvent for stalled proposals (>5 days)", async () => {
        const stalledProposal = [
            { id: "prop-1", status: "sent", assessment: { company: "AcmeCorp" } },
        ];
        (prisma.proposal.findMany as any).mockResolvedValue(stalledProposal);
        (prisma as any).systemEvent.findFirst.mockResolvedValue(null);

        await runAnomalyDetectionSweep("org-test");

        const proposalCall = (logSystemEvent as any).mock.calls.find(
            (c: any[]) => c[0].entityType === "Proposal"
        );
        expect(proposalCall).toBeDefined();
        expect(proposalCall[0].entityId).toBe("prop-1");
        expect(proposalCall[0].payload.severity).toBe("high");
    });

    it("calls logSystemEvent for stalled workspace provisioning", async () => {
        const stalledWs = [{ id: "ws-1", status: "provisioning" }];
        (prisma.clientWorkspace.findMany as any).mockResolvedValue(stalledWs);
        (prisma as any).systemEvent.findFirst.mockResolvedValue(null);

        await runAnomalyDetectionSweep("org-test");

        const wsCall = (logSystemEvent as any).mock.calls.find(
            (c: any[]) => c[0].entityType === "ClientWorkspace"
        );
        expect(wsCall).toBeDefined();
        expect(wsCall[0].entityId).toBe("ws-1");
        expect(wsCall[0].payload.severity).toBe("critical");
    });

    it("handles multiple alert categories independently in one sweep", async () => {
        (prisma.assessment.findMany as any).mockResolvedValue([{ id: "lead-A", name: "X", company: "Y" }]);
        (prisma.proposal.findMany as any).mockResolvedValue([{ id: "prop-A", status: "sent", assessment: { company: "Y" } }]);
        (prisma.clientWorkspace.findMany as any).mockResolvedValue([{ id: "ws-A", status: "provisioning" }]);
        (prisma as any).systemEvent.findFirst.mockResolvedValue(null);

        await runAnomalyDetectionSweep("org-test");
        // One for each category = 3 total calls
        expect(logSystemEvent).toHaveBeenCalledTimes(3);
    });

    it("payload description mentions lead name and company for stale lead alert", async () => {
        (prisma.assessment.findMany as any).mockResolvedValue([
            { id: "lead-Z", name: "Fernanda Lima", company: "TechCorp", status: "Novo" },
        ]);
        (prisma as any).systemEvent.findFirst.mockResolvedValue(null);

        await runAnomalyDetectionSweep("org-test");

        const call = (logSystemEvent as any).mock.calls[0][0];
        expect(call.payload.description).toContain("Fernanda Lima");
        expect(call.payload.description).toContain("TechCorp");
    });
});
