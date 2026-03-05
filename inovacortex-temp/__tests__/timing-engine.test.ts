/**
 * __tests__/timing-engine.test.ts
 * V17: Tests for shouldEscalateProposal()
 */

jest.mock("@/lib/prisma", () => ({
    prisma: {
        meetingSession: {
            findUnique: jest.fn(),
        },
        proposal: {
            findFirst: jest.fn(),
        },
        actionQueue: {
            updateMany: jest.fn(),
            findFirst: jest.fn(),
        },
    },
}));

import { shouldEscalateProposal } from "@/lib/timing-engine";
import { prisma } from "@/lib/prisma";

const mockSessionFindUnique = (prisma as any).meetingSession.findUnique as jest.MockedFunction<any>;
const mockProposalFindFirst = (prisma as any).proposal.findFirst as jest.MockedFunction<any>;
const mockQueueUpdateMany = (prisma as any).actionQueue.updateMany as jest.MockedFunction<any>;
const mockQueueFindFirst = (prisma as any).actionQueue.findFirst as jest.MockedFunction<any>;

function buildSession(overrides: Partial<any> = {}) {
    return {
        id: "sess-1",
        organizationId: "org-1",
        assessmentId: "assess-1",
        closeProbability: 0.40,
        adjustedProbability: 0.40,
        status: "completed",
        endAt: new Date(Date.now() - 90 * 60 * 1000), // ended 90 min ago
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockQueueUpdateMany.mockResolvedValue({ count: 1 });
    mockQueueFindFirst.mockResolvedValue({ priority: "medium" });
    mockProposalFindFirst.mockResolvedValue(null);
});

describe("shouldEscalateProposal", () => {
    it("throws if session not found", async () => {
        mockSessionFindUnique.mockResolvedValue(null);
        await expect(shouldEscalateProposal("nonexistent")).rejects.toThrow("MeetingSession not found");
    });

    it("Rule 3: probability >= 0.70 → critical, escalate=true", async () => {
        mockSessionFindUnique.mockResolvedValue(buildSession({ adjustedProbability: 0.75 }));
        mockProposalFindFirst.mockResolvedValue(null);

        const result = await shouldEscalateProposal("sess-1");
        expect(result.escalate).toBe(true);
        expect(result.newPriority).toBe("critical");
        expect(result.reason).toMatch(/70%/);
    });

    it("Rule 3 is checked BEFORE rule 2 (highest precedence)", async () => {
        // Both rule 2 and rule 3 trigger: probability=0.80, proposal sent > 24h
        const oldSent = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30h ago
        mockSessionFindUnique.mockResolvedValue(buildSession({ adjustedProbability: 0.80 }));
        mockProposalFindFirst.mockResolvedValue({
            id: "p1", status: "sent", updatedAt: oldSent,
        });

        const result = await shouldEscalateProposal("sess-1");
        expect(result.newPriority).toBe("critical");
        // Reason should mention probability (rule 3 ran first)
        expect(result.reason).toMatch(/70%/);
    });

    it("Rule 2: proposal sent > 24h → critical", async () => {
        const oldSent = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30h ago
        mockSessionFindUnique.mockResolvedValue(buildSession({ adjustedProbability: 0.40 }));
        mockProposalFindFirst.mockResolvedValue({
            id: "p1", status: "sent", updatedAt: oldSent,
        });

        const result = await shouldEscalateProposal("sess-1");
        expect(result.escalate).toBe(true);
        expect(result.newPriority).toBe("critical");
        expect(result.reason).toMatch(/\d+h/i); // engine shows actual elapsed hours (e.g. "30h")
    });

    it("Rule 2 does NOT trigger if proposal sent < 24h ago", async () => {
        const recentSent = new Date(Date.now() - 6 * 60 * 60 * 1000); // 6h ago
        mockSessionFindUnique.mockResolvedValue(buildSession({ adjustedProbability: 0.40 }));
        mockProposalFindFirst.mockResolvedValue({
            id: "p1", status: "sent", updatedAt: recentSent,
        });

        const result = await shouldEscalateProposal("sess-1");
        expect(result.escalate).toBe(false);
    });

    it("Rule 1: no proposal 60+ min after meeting ended → high", async () => {
        mockSessionFindUnique.mockResolvedValue(buildSession({
            adjustedProbability: 0.35,
            assessmentId: "assess-1",
            endAt: new Date(Date.now() - 90 * 60 * 1000), // 90 min ago
            status: "completed",
        }));
        mockProposalFindFirst.mockResolvedValue(null); // no proposal yet
        mockQueueFindFirst.mockResolvedValue({ priority: "medium" }); // not already elevated

        const result = await shouldEscalateProposal("sess-1");
        expect(result.escalate).toBe(true);
        expect(result.newPriority).toBe("high");
        expect(result.reason).toMatch(/min/);
    });

    it("Rule 1 does NOT trigger if meeting ended < 60 min ago", async () => {
        mockSessionFindUnique.mockResolvedValue(buildSession({
            adjustedProbability: 0.35,
            endAt: new Date(Date.now() - 30 * 60 * 1000), // only 30 min ago
            status: "completed",
        }));
        mockProposalFindFirst.mockResolvedValue(null);

        const result = await shouldEscalateProposal("sess-1");
        expect(result.escalate).toBe(false);
    });

    it("no escalation when all rules pass", async () => {
        // Probability low, proposal accepted recently
        mockSessionFindUnique.mockResolvedValue(buildSession({ adjustedProbability: 0.30 }));
        mockProposalFindFirst.mockResolvedValue({
            id: "p1", status: "accepted", updatedAt: new Date(),
        });

        const result = await shouldEscalateProposal("sess-1");
        expect(result.escalate).toBe(false);
        expect(result.reason).toMatch(/nenhuma/i);
    });

    it("syncs ActionQueue to critical when escalating to critical", async () => {
        mockSessionFindUnique.mockResolvedValue(buildSession({ adjustedProbability: 0.80 }));

        await shouldEscalateProposal("sess-1");

        expect(mockQueueUpdateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { priority: "critical" },
            })
        );
    });
});
