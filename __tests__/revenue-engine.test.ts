const prismaMock = {
    assessment: {
        findMany: jest.fn(),
    },
    proposal: {
        count: jest.fn(),
    },
    activity: {
        count: jest.fn(),
    },
};

jest.mock("../lib/prisma", () => ({
    prisma: prismaMock,
}));

import {
    buildRevenueEngineSnapshot,
    buildTenantRevenueSignals,
} from "../lib/commercial/revenue-engine";

describe("Revenue engine", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("calculates open revenue, at-risk revenue and stagnation from canonical records", () => {
        const snapshot = buildRevenueEngineSnapshot({
            now: new Date("2026-03-17T12:00:00.000Z"),
            proposalEntriesCurrentWindow: 2,
            proposalEntriesPreviousWindow: 4,
            activityEntriesCurrentWindow: 5,
            activityEntriesPreviousWindow: 7,
            records: [
                {
                    assessmentId: "assessment-1",
                    company: "Acme",
                    dealId: "deal-1",
                    dealStatus: "open",
                    dealStageId: "stage-proposal",
                    dealStageLabel: "Proposal",
                    dealCreatedAt: "2026-03-01T12:00:00.000Z",
                    dealValueCents: 0,
                    latestActivityAt: "2026-03-07T12:00:00.000Z",
                    proposalId: "proposal-1",
                    proposalStatus: "viewed",
                    proposalUpdatedAt: "2026-03-10T12:00:00.000Z",
                    proposalValueCents: 250_000,
                    conversationId: "conversation-1",
                    unreadCount: 2,
                    conversationLastMessageAt: "2026-03-15T08:00:00.000Z",
                    conversationSlaDueAt: "2026-03-16T08:00:00.000Z",
                    contactLastInboundAt: "2026-03-09T08:00:00.000Z",
                    contactLastOutboundAt: "2026-03-08T08:00:00.000Z",
                    ownerId: "owner-1",
                    ownerLabel: "Maria",
                },
                {
                    assessmentId: "assessment-2",
                    company: "Globex",
                    dealId: "deal-2",
                    dealStatus: "open",
                    dealStageId: "stage-discovery",
                    dealStageLabel: "Discovery",
                    dealCreatedAt: "2026-03-01T12:00:00.000Z",
                    dealValueCents: 180_000,
                    latestActivityAt: "2026-03-08T12:00:00.000Z",
                    proposalId: null,
                    proposalStatus: "none",
                    proposalUpdatedAt: null,
                    proposalValueCents: 0,
                    conversationId: null,
                    unreadCount: 0,
                    conversationLastMessageAt: null,
                    conversationSlaDueAt: null,
                    contactLastInboundAt: null,
                    contactLastOutboundAt: null,
                    ownerId: null,
                    ownerLabel: "Sem responsavel",
                },
            ],
        });

        expect(snapshot.estimatedOpenRevenueCents).toBe(430_000);
        expect(snapshot.estimatedRevenueAtRiskCents).toBe(430_000);
        expect(snapshot.stalledProposals.count).toBe(1);
        expect(snapshot.inactiveDeals.count).toBe(1);
        expect(snapshot.quietCriticalConversations.count).toBe(1);
        expect(snapshot.proposalsWithoutResponse.count).toBe(1);
        expect(snapshot.mostStagnantStage?.stageLabel).toBe("Proposal");
        expect(snapshot.topAtRiskOpportunities[0]).toMatchObject({
            company: "Acme",
            recommendedAction: "Cobrar proposta parada agora.",
        });
        expect(snapshot.agingBuckets.length).toBeGreaterThan(0);
        expect(snapshot.riskByStage[0]).toMatchObject({ stageLabel: "Proposal" });
        expect(snapshot.riskByOwner[0]).toMatchObject({ ownerLabel: "Maria" });
        expect(snapshot.conversionTrend).toMatchObject({ current: 2, previous: 4, delta: -2, direction: "down" });
        expect(snapshot.summary.tone).toBe("critical");
    });

    test("keeps tenant scoping explicit in all revenue queries", async () => {
        prismaMock.assessment.findMany.mockResolvedValue([]);
        prismaMock.proposal.count
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0);
        prismaMock.activity.count
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0);

        await buildTenantRevenueSignals("org-1");

        expect(prismaMock.assessment.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                organizationId: "org-1",
            }),
        }));
        expect(prismaMock.proposal.count).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: expect.objectContaining({
                organizationId: "org-1",
            }),
        }));
        expect(prismaMock.proposal.count).toHaveBeenNthCalledWith(2, expect.objectContaining({
            where: expect.objectContaining({
                organizationId: "org-1",
            }),
        }));
        expect(prismaMock.activity.count).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: expect.objectContaining({
                organizationId: "org-1",
            }),
        }));
        expect(prismaMock.activity.count).toHaveBeenNthCalledWith(2, expect.objectContaining({
            where: expect.objectContaining({
                organizationId: "org-1",
            }),
        }));
    });

    test("uses the provided db client when building revenue signals", async () => {
        const txMock = {
            assessment: {
                findMany: jest.fn().mockResolvedValue([]),
            },
            proposal: {
                count: jest.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(0),
            },
            activity: {
                count: jest.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(0),
            },
        };

        await buildTenantRevenueSignals("org-tx", txMock as never);

        expect(txMock.assessment.findMany).toHaveBeenCalledTimes(1);
        expect(txMock.proposal.count).toHaveBeenCalledTimes(2);
        expect(txMock.activity.count).toHaveBeenCalledTimes(2);
        expect(prismaMock.assessment.findMany).not.toHaveBeenCalled();
    });
});
