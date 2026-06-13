const mockPrisma = {
    assessment: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    contact: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    deal: {
        findFirst: jest.fn(),
        create: jest.fn(),
    },
    pipeline: {
        findFirst: jest.fn(),
        create: jest.fn(),
    },
    pipelineStage: {
        findFirst: jest.fn(),
        createMany: jest.fn(),
    },
    activity: {
        create: jest.fn(),
    },
};

jest.mock("../lib/prisma", () => ({
    prisma: mockPrisma,
}));

jest.mock("../lib/whatsapp", () => ({
    normalizePhone: jest.fn((raw: string) => raw.replace(/\D/g, "").replace(/^(?!55)/, "55")),
}));

jest.mock("../lib/onboarding-status", () => ({
    recordOnboardingPipelineConfigured: jest.fn(async () => undefined),
    recordOnboardingFirstContact: jest.fn(async () => undefined),
    recordOnboardingFirstDeal: jest.fn(async () => undefined),
}));

import {
    ensureAssessmentCommercialFlow,
    ensureCommercialDealForContact,
} from "../lib/commercial/canonical-flow";

describe("canonical commercial flow", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("links an assessment into the canonical contact and deal flow", async () => {
        mockPrisma.assessment.findUnique.mockResolvedValue({
            id: "assessment-1",
            organizationId: "org-1",
            name: "Maria",
            company: "Acme",
            phone: "(11) 99999-8888",
            contactId: null,
            dealId: null,
        });
        mockPrisma.contact.findUnique.mockResolvedValue(null);
        mockPrisma.contact.create.mockResolvedValue({ id: "contact-1" });
        mockPrisma.deal.findFirst.mockResolvedValue(null);
        mockPrisma.pipeline.findFirst.mockResolvedValue({ id: "pipeline-1" });
        mockPrisma.pipelineStage.findFirst.mockResolvedValue({ id: "stage-1" });
        mockPrisma.deal.create.mockResolvedValue({ id: "deal-1" });
        mockPrisma.activity.create
            .mockResolvedValueOnce({ id: "activity-deal-created" })
            .mockResolvedValueOnce({ id: "activity-assessment-linked" });
        mockPrisma.assessment.update.mockResolvedValue({ id: "assessment-1" });

        const result = await ensureAssessmentCommercialFlow({
            assessmentId: "assessment-1",
            source: "assessment",
        });

        expect(mockPrisma.contact.create).toHaveBeenCalledWith({
            data: {
                organizationId: "org-1",
                phoneNumberE164: "5511999998888",
                name: "Maria",
            },
            select: { id: true },
        });
        expect(mockPrisma.deal.create).toHaveBeenCalledWith({
            data: {
                organizationId: "org-1",
                contactId: "contact-1",
                stageId: "stage-1",
                value: null,
                status: "open",
            },
            select: { id: true },
        });
        expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
            where: { id: "assessment-1" },
            data: {
                contactId: "contact-1",
                dealId: "deal-1",
            },
        });
        expect(result).toMatchObject({
            assessmentId: "assessment-1",
            organizationId: "org-1",
            contactId: "contact-1",
            dealId: "deal-1",
            created: true,
            contactCreated: true,
            assessmentLinked: true,
            assessmentLinkedActivityId: "activity-assessment-linked",
        });
    });

    test("reuses existing scoped contact and deal without duplicate transition activity", async () => {
        mockPrisma.assessment.findUnique.mockResolvedValue({
            id: "assessment-2",
            organizationId: "org-1",
            name: "Joao",
            company: "Beta",
            phone: "5511888887777",
            contactId: "contact-2",
            dealId: "deal-2",
        });
        mockPrisma.contact.findFirst.mockResolvedValue({ id: "contact-2" });
        mockPrisma.deal.findFirst.mockResolvedValue({
            id: "deal-2",
            stage: {
                id: "stage-2",
                pipelineId: "pipeline-2",
            },
        });

        const result = await ensureAssessmentCommercialFlow({
            assessmentId: "assessment-2",
            source: "proposal",
        });

        expect(mockPrisma.assessment.update).not.toHaveBeenCalled();
        expect(mockPrisma.activity.create).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            contactId: "contact-2",
            dealId: "deal-2",
            reused: true,
            contactReused: true,
            assessmentLinked: false,
        });
    });

    test("falls back safely when the assessment has no phone to promote into contact/deal", async () => {
        mockPrisma.assessment.findUnique.mockResolvedValue({
            id: "assessment-3",
            organizationId: "org-1",
            name: "Lead sem telefone",
            company: "Gamma",
            phone: null,
            contactId: null,
            dealId: null,
        });

        const result = await ensureAssessmentCommercialFlow({
            assessmentId: "assessment-3",
        });

        expect(mockPrisma.contact.create).not.toHaveBeenCalled();
        expect(mockPrisma.deal.create).not.toHaveBeenCalled();
        expect(mockPrisma.assessment.update).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            contactId: null,
            dealId: null,
            assessmentLinked: false,
        });
    });

    test("ignores a stale cross-tenant deal link and resolves a scoped canonical deal", async () => {
        mockPrisma.deal.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        mockPrisma.pipeline.findFirst.mockResolvedValue({ id: "pipeline-9" });
        mockPrisma.pipelineStage.findFirst.mockResolvedValue({ id: "stage-9" });
        mockPrisma.deal.create.mockResolvedValue({ id: "deal-9" });
        mockPrisma.activity.create.mockResolvedValue({ id: "activity-deal-created" });

        const result = await ensureCommercialDealForContact({
            organizationId: "org-1",
            contactId: "contact-9",
            existingDealId: "deal-from-other-tenant",
            source: "proposal",
            assessmentId: "assessment-9",
            company: "Delta",
        });

        expect(mockPrisma.deal.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: expect.objectContaining({
                id: "deal-from-other-tenant",
                organizationId: "org-1",
                contactId: "contact-9",
            }),
        }));
        expect(mockPrisma.deal.create).toHaveBeenCalled();
        expect(result).toMatchObject({
            dealId: "deal-9",
            created: true,
            reused: false,
            dealCreatedActivityId: "activity-deal-created",
        });
    });
});
