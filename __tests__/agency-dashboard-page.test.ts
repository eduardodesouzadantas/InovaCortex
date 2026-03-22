const getAuthContextMock = jest.fn();
const redirectMock = jest.fn(() => {
    throw new Error("redirect");
});
const buildAgencySurfaceOverviewMock = jest.fn();

jest.mock("../lib/auth/session", () => ({
    getAuthContext: getAuthContextMock,
}));

jest.mock("next/navigation", () => ({
    redirect: redirectMock,
}));

jest.mock("../lib/agency/surface-overview", () => ({
    buildAgencySurfaceOverview: buildAgencySurfaceOverviewMock,
}));

import AgencyDashboardPage from "../app/agency/dashboard/page";

describe("Agency dashboard page", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        redirectMock.mockImplementation(() => {
            throw new Error("redirect");
        });
    });

    test("loads the dashboard for authenticated agency users", async () => {
        getAuthContextMock.mockResolvedValue({
            isAuthenticated: true,
            authScope: "agency",
            organizationId: "agency-org",
        });
        buildAgencySurfaceOverviewMock.mockResolvedValue({
            generatedAt: "2026-03-22T12:00:00.000Z",
            overview: {
                headline: "Dashboard",
                subheadline: "Resumo",
                commandTone: "neutral",
                commandSummary: "Resumo",
                focusNow: [],
            },
            controlPlane: { title: "Control", description: "", focus: "", metrics: [], items: [] },
            agencyOps: { title: "Ops", description: "", focus: "", metrics: [], items: [] },
            proofOfValue: { tone: "neutral", headline: "", impactMetrics: [], insights: [] },
            priorityQueue: [],
            retentionSignals: [],
            expansionSignals: [],
            successPlaybooks: [],
            playbookTimeline: [],
            benchmarks: [],
            warnings: [],
        });

        const element = await AgencyDashboardPage();

        expect(buildAgencySurfaceOverviewMock).toHaveBeenCalledWith("agency-org");
        expect(redirectMock).not.toHaveBeenCalled();
        expect(element).toBeTruthy();
    });

    test("redirects unauthenticated users to agency login", async () => {
        getAuthContextMock.mockResolvedValue({
            isAuthenticated: false,
            authScope: null,
            organizationId: null,
        });

        await expect(AgencyDashboardPage()).rejects.toThrow("redirect");
        expect(redirectMock).toHaveBeenCalledWith("/agency/login");
    });
});
