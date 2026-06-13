const ensureAssessmentCommercialFlowMock = jest.fn();
const generateProposalMock = jest.fn();
const logAuditMock = jest.fn();

const mockPrisma = {
    assessment: {
        findUnique: jest.fn(),
    },
    roiProjection: {
        findUnique: jest.fn(),
    },
    preSalesArtifact: {
        findFirst: jest.fn(),
    },
    proposal: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
    },
    activity: {
        create: jest.fn(),
    },
};

jest.mock("../lib/prisma", () => ({
    prisma: mockPrisma,
}));

jest.mock("../lib/commercial/canonical-flow", () => ({
    ensureAssessmentCommercialFlow: ensureAssessmentCommercialFlowMock,
}));

jest.mock("../lib/proposal-engine", () => ({
    generateProposal: generateProposalMock,
}));

jest.mock("../lib/audit", () => ({
    logAudit: logAuditMock,
}));

jest.mock("../lib/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock("../lib/http/route-errors", () => ({
    isAIUnavailableError: jest.fn(() => false),
    toAIUnavailableError: jest.fn(),
}));

import {
    generateProposalHandler,
    updateProposalHandler,
} from "../lib/agency/commercial/leads";

describe("agency commercial lead handlers", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("generateProposalHandler persists proposals on the canonical deal", async () => {
        mockPrisma.assessment.findUnique.mockResolvedValue({
            id: "assessment-1",
            organizationId: "org-1",
            name: "Maria",
            company: "Acme",
        });
        mockPrisma.roiProjection.findUnique.mockResolvedValue(null);
        mockPrisma.preSalesArtifact.findFirst.mockResolvedValue(null);
        mockPrisma.proposal.findMany.mockResolvedValue([]);
        ensureAssessmentCommercialFlowMock.mockResolvedValue({
            dealId: "deal-1",
        });
        generateProposalMock.mockReturnValue({
            version: 1,
            publicSlug: "proposal-slug",
            modules: [{ key: "core" }],
            pricingEstimate: { minBRL: 12000, maxBRL: 18000 },
            roiSnapshot: { revenueIncrease: 25000 },
            presalesSnapshot: { summary: "ok" },
        });
        mockPrisma.proposal.create.mockResolvedValue({
            id: "proposal-1",
            status: "draft",
        });
        mockPrisma.activity.create.mockResolvedValue({ id: "activity-1" });

        const response = await generateProposalHandler("assessment-1");
        const payload = await response.json();

        expect(ensureAssessmentCommercialFlowMock).toHaveBeenCalledWith({
            assessmentId: "assessment-1",
            source: "proposal",
        });
        expect(mockPrisma.proposal.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                assessmentId: "assessment-1",
                organizationId: "org-1",
                dealId: "deal-1",
                publicSlug: "proposal-slug",
                status: "draft",
            }),
        });
        expect(mockPrisma.activity.create).toHaveBeenCalledWith({
            data: {
                organizationId: "org-1",
                dealId: "deal-1",
                type: "proposal_created",
                note: "Proposal proposal-1 v1 generated from assessment assessment-1",
            },
        });
        expect(logAuditMock).toHaveBeenCalledWith("presales", "assessment-1", "proposalGenerated", expect.any(Object));
        expect(payload.success).toBe(true);
    });

    test("updateProposalHandler backfills canonical deal linkage before status activity", async () => {
        mockPrisma.proposal.findFirst.mockResolvedValue({
            id: "proposal-9",
            status: "draft",
            dealId: null,
            assessment: {
                organizationId: "org-9",
            },
        });
        ensureAssessmentCommercialFlowMock.mockResolvedValue({
            dealId: "deal-9",
        });
        mockPrisma.proposal.update.mockResolvedValue({
            id: "proposal-9",
            status: "sent",
            dealId: "deal-9",
        });
        mockPrisma.activity.create.mockResolvedValue({ id: "activity-9" });

        const request = new Request("http://localhost/api", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                proposalId: "proposal-9",
                status: "sent",
            }),
        });

        const response = await updateProposalHandler(request as any, "assessment-9");
        const payload = await response.json();

        expect(ensureAssessmentCommercialFlowMock).toHaveBeenCalledWith({
            assessmentId: "assessment-9",
            source: "proposal",
        });
        expect(mockPrisma.proposal.update).toHaveBeenCalledWith({
            where: { id: "proposal-9" },
            data: expect.objectContaining({
                status: "sent",
                dealId: "deal-9",
            }),
        });
        expect(mockPrisma.activity.create).toHaveBeenCalledWith({
            data: {
                organizationId: "org-9",
                dealId: "deal-9",
                type: "proposal_status_changed",
                note: "Proposal proposal-9 status changed from draft to sent",
            },
        });
        expect(payload.success).toBe(true);
    });
});
