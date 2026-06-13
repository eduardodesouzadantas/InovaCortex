const mockOnboardingUpsert = jest.fn();
const mockOnboardingUpdate = jest.fn();
const mockEmailIntegrationFindFirst = jest.fn();
const mockPipelineFindFirst = jest.fn();
const mockContactFindFirst = jest.fn();
const mockDealFindFirst = jest.fn();

jest.mock("../lib/prisma", () => ({
    prisma: {
        onboardingStatus: {
            upsert: mockOnboardingUpsert,
            update: mockOnboardingUpdate,
        },
        emailIntegration: {
            findFirst: mockEmailIntegrationFindFirst,
        },
        pipeline: {
            findFirst: mockPipelineFindFirst,
        },
        contact: {
            findFirst: mockContactFindFirst,
        },
        deal: {
            findFirst: mockDealFindFirst,
        },
    },
}));

import {
    ensureOnboardingStatus,
    getTenantReadinessFromOnboarding,
    isTenantReady,
    recordOnboardingEmailConnected,
    recordOnboardingFirstContact,
    recordOnboardingFirstDeal,
    recordOnboardingPipelineConfigured,
    refreshOnboardingStatusFromTenant,
} from "../lib/onboarding-status";

describe("onboarding status", () => {
    const baseRow = {
        organizationId: "org-1",
        status: "not_started",
        emailConnectedAt: null,
        pipelineConfiguredAt: null,
        firstContactAt: null,
        firstDealAt: null,
        completedAt: null,
        createdAt: new Date("2026-03-18T10:00:00.000Z"),
        updatedAt: new Date("2026-03-18T10:00:00.000Z"),
    };

    let currentRow = { ...baseRow };

    beforeEach(() => {
        jest.clearAllMocks();
        currentRow = { ...baseRow };

        mockOnboardingUpsert.mockImplementation(async ({ create }) => {
            if (!currentRow) {
                currentRow = {
                    ...baseRow,
                    ...create,
                };
            }

            return currentRow;
        });

        mockOnboardingUpdate.mockImplementation(async ({ data }) => {
            currentRow = {
                ...currentRow,
                ...data,
                updatedAt: new Date("2026-03-18T12:00:00.000Z"),
            };

            return currentRow;
        });

        mockEmailIntegrationFindFirst.mockResolvedValue(null);
        mockPipelineFindFirst.mockResolvedValue(null);
        mockContactFindFirst.mockResolvedValue(null);
        mockDealFindFirst.mockResolvedValue(null);
    });

    it("initializes a not started snapshot", async () => {
        const snapshot = await ensureOnboardingStatus("org-1");

        expect(snapshot.status).toBe("not_started");
        expect(snapshot.progressPercent).toBe(0);
        expect(snapshot.steps).toHaveLength(3);
    });

    it("derives tenant readiness blockers from the onboarding snapshot", async () => {
        const snapshot = await ensureOnboardingStatus("org-1");
        const readiness = getTenantReadinessFromOnboarding(snapshot);

        expect(readiness.ready).toBe(false);
        expect(readiness.blockers.map((blocker) => blocker.id)).toEqual([
            "email",
            "pipeline",
            "first_crm_record",
        ]);
    });

    it("advances the onboarding state as steps are completed", async () => {
        const emailCompletedAt = new Date("2026-03-18T10:15:00.000Z");
        const pipelineCompletedAt = new Date("2026-03-18T10:20:00.000Z");
        const contactCompletedAt = new Date("2026-03-18T10:25:00.000Z");
        const dealCompletedAt = new Date("2026-03-18T10:30:00.000Z");

        let snapshot = await recordOnboardingEmailConnected("org-1", emailCompletedAt);
        expect(snapshot.status).toBe("in_progress");
        expect(snapshot.emailConnectedAt).toBe(emailCompletedAt.toISOString());

        snapshot = await recordOnboardingPipelineConfigured("org-1", pipelineCompletedAt);
        expect(snapshot.status).toBe("in_progress");
        expect(snapshot.pipelineConfiguredAt).toBe(pipelineCompletedAt.toISOString());

        snapshot = await recordOnboardingFirstContact("org-1", contactCompletedAt);
        expect(snapshot.status).toBe("completed");
        expect(snapshot.firstContactAt).toBe(contactCompletedAt.toISOString());

        snapshot = await recordOnboardingFirstDeal("org-1", dealCompletedAt);
        expect(snapshot.status).toBe("completed");
        expect(snapshot.completedAt).toBe(contactCompletedAt.toISOString());
    });

    it("backfills onboarding progress from current tenant state", async () => {
        mockEmailIntegrationFindFirst.mockResolvedValueOnce({
            updatedAt: new Date("2026-03-18T10:10:00.000Z"),
        });
        mockPipelineFindFirst.mockResolvedValueOnce({
            createdAt: new Date("2026-03-18T10:20:00.000Z"),
        });
        mockContactFindFirst.mockResolvedValueOnce({
            createdAt: new Date("2026-03-18T10:30:00.000Z"),
        });
        mockDealFindFirst.mockResolvedValueOnce({
            createdAt: new Date("2026-03-18T10:40:00.000Z"),
        });

        const snapshot = await refreshOnboardingStatusFromTenant("org-1");

        expect(snapshot.status).toBe("completed");
        expect(snapshot.progressPercent).toBe(100);
        expect(snapshot.firstCrmRecordAt).toBe("2026-03-18T10:30:00.000Z");
        expect(mockOnboardingUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                emailConnectedAt: new Date("2026-03-18T10:10:00.000Z"),
                pipelineConfiguredAt: new Date("2026-03-18T10:20:00.000Z"),
                firstContactAt: new Date("2026-03-18T10:30:00.000Z"),
                firstDealAt: new Date("2026-03-18T10:40:00.000Z"),
                status: "completed",
            }),
        }));
    });

    it("reports tenant ready when the minimum operational checklist is complete", async () => {
        mockEmailIntegrationFindFirst.mockResolvedValueOnce({
            updatedAt: new Date("2026-03-18T10:10:00.000Z"),
        });
        mockPipelineFindFirst.mockResolvedValueOnce({
            createdAt: new Date("2026-03-18T10:20:00.000Z"),
        });
        mockContactFindFirst.mockResolvedValueOnce({
            createdAt: new Date("2026-03-18T10:30:00.000Z"),
        });
        mockDealFindFirst.mockResolvedValueOnce({
            createdAt: new Date("2026-03-18T10:40:00.000Z"),
        });

        const readiness = await isTenantReady("org-1");

        expect(readiness.ready).toBe(true);
        expect(readiness.blockers).toHaveLength(0);
    });
});
