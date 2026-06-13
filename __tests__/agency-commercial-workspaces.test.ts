const mockWorkspaceFindFirst = jest.fn();
const mockMarkGoLive = jest.fn();
const mockIsTenantReady = jest.fn();
const mockGetOrganizationAccountStatus = jest.fn();

jest.mock("../lib/prisma", () => ({
    prisma: {
        clientWorkspace: {
            findFirst: mockWorkspaceFindFirst,
        },
    },
}));

jest.mock("../lib/provisioning", () => ({
    markGoLive: mockMarkGoLive,
    runNudgeChecks: jest.fn(),
    updateTaskStatus: jest.fn(),
}));

jest.mock("../lib/onboarding-status", () => ({
    isTenantReady: mockIsTenantReady,
}));

jest.mock("../lib/billing/account-status", () => ({
    getOrganizationAccountStatus: mockGetOrganizationAccountStatus,
    ORGANIZATION_BILLING_SUSPENDED_MESSAGE: "Conta suspensa. Regularize o billing para continuar.",
}));

import { goLiveWorkspaceHandler } from "../lib/agency/commercial/workspaces";

describe("goLiveWorkspaceHandler", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockWorkspaceFindFirst.mockResolvedValue({
            id: "workspace-1",
            assessmentId: "assessment-1",
        });
        mockGetOrganizationAccountStatus.mockResolvedValue("trial");
    });

    it("blocks go-live for suspended accounts before onboarding readiness", async () => {
        mockGetOrganizationAccountStatus.mockResolvedValue("suspended");

        const response = await goLiveWorkspaceHandler("org-1", "workspace-1");
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toBe("FORBIDDEN");
        expect(body.message).toBe("Conta suspensa. Regularize o billing para continuar.");
        expect(mockIsTenantReady).not.toHaveBeenCalled();
        expect(mockMarkGoLive).not.toHaveBeenCalled();
    });

    it("blocks go-live when the tenant is not ready", async () => {
        mockIsTenantReady.mockResolvedValue({
            organizationId: "org-1",
            ready: false,
            blockers: [
                {
                    id: "email",
                    label: "Conectar email",
                    detail: "A conexao OAuth do tenant ja esta ativa.",
                    completed: false,
                },
            ],
            completedStepCount: 0,
            totalStepCount: 3,
            onboarding: {
                organizationId: "org-1",
                status: "not_started",
                progressPercent: 0,
                completedStepCount: 0,
                totalStepCount: 3,
                emailConnectedAt: null,
                pipelineConfiguredAt: null,
                firstContactAt: null,
                firstDealAt: null,
                firstCrmRecordAt: null,
                completedAt: null,
                updatedAt: "2026-03-18T10:00:00.000Z",
                steps: [],
            },
        });

        const response = await goLiveWorkspaceHandler("org-1", "workspace-1");
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.error).toBe("TENANT_NOT_READY");
        expect(mockMarkGoLive).not.toHaveBeenCalled();
    });

    it("allows go-live when the tenant is ready", async () => {
        mockIsTenantReady.mockResolvedValue({
            organizationId: "org-1",
            ready: true,
            blockers: [],
            completedStepCount: 3,
            totalStepCount: 3,
            onboarding: {
                organizationId: "org-1",
                status: "completed",
                progressPercent: 100,
                completedStepCount: 3,
                totalStepCount: 3,
                emailConnectedAt: "2026-03-18T10:00:00.000Z",
                pipelineConfiguredAt: "2026-03-18T10:10:00.000Z",
                firstContactAt: "2026-03-18T10:20:00.000Z",
                firstDealAt: "2026-03-18T10:30:00.000Z",
                firstCrmRecordAt: "2026-03-18T10:20:00.000Z",
                completedAt: "2026-03-18T10:30:00.000Z",
                updatedAt: "2026-03-18T10:30:00.000Z",
                steps: [],
            },
        });

        const response = await goLiveWorkspaceHandler("org-1", "workspace-1");
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockMarkGoLive).toHaveBeenCalledWith("workspace-1", "assessment-1", "org-1");
    });
});
