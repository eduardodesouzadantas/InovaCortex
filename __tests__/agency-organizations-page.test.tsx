jest.mock("next/link", () => {
    const ReactModule = jest.requireActual<typeof import("react")>("react");
    return {
        __esModule: true,
        default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
            ReactModule.createElement("a", { href, ...props }, children),
    };
});

const getAuthContextMock = jest.fn();
const redirectMock = jest.fn();
const listOrganizationsMock = jest.fn();

jest.mock("../lib/auth/session", () => ({
    getAuthContext: getAuthContextMock,
}));

jest.mock("next/navigation", () => ({
    redirect: (...args: [string]) => {
        redirectMock(...args);
        throw new Error("NEXT_REDIRECT");
    },
}));

jest.mock("../lib/repositories/organizationRepository", () => ({
    ORGANIZATION_LIFECYCLE_STATUS_OPTIONS: ["all", "active", "suspended", "onboarding"],
    getOrganizationLifecycleStatusLabel: (status: string) =>
        ({ active: "Ativo", suspended: "Suspenso", onboarding: "Onboarding" } as Record<string, string>)[status] ?? status,
    listOrganizations: listOrganizationsMock,
    normalizeOrganizationLifecycleFilter: (value: string | undefined) =>
        value === "active" || value === "suspended" || value === "onboarding" ? value : "all",
}));

import { renderToStaticMarkup } from "react-dom/server";

import AgencyOrganizationsPage from "../app/agency/organizations/page";

describe("AgencyOrganizationsPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("renders organizations with status filters and detail links", async () => {
        getAuthContextMock.mockResolvedValue({
            isAuthenticated: true,
            authScope: "agency",
            organizationId: "agency-org",
            role: "admin",
        });
        listOrganizationsMock.mockResolvedValue({
            organizations: [
                {
                    id: "org-1",
                    name: "Acme",
                    lifecycleStatus: "active",
                    createdAt: "2026-03-16T10:00:00.000Z",
                    latestWorkspace: {
                        id: "ws-1",
                        status: "active",
                        createdAt: "2026-03-17T09:00:00.000Z",
                        goLiveAt: "2026-03-17T10:00:00.000Z",
                        proposalId: "proposal-1",
                        assessmentId: "assessment-1",
                    },
                },
            ],
            pagination: {
                page: 1,
                limit: 20,
                skip: 0,
                total: 1,
                pageCount: 1,
                hasNextPage: false,
                hasPreviousPage: false,
            },
        });

        const element = await AgencyOrganizationsPage({
            searchParams: Promise.resolve({ status: "active", page: "1" }),
        });
        const html = renderToStaticMarkup(element as React.ReactElement);

        expect(listOrganizationsMock).toHaveBeenCalledWith({
            page: 1,
            limit: 20,
            status: "active",
        });
        expect(html).toContain("Organizations");
        expect(html).toContain("Visibilidade centralizada");
        expect(html).toContain("Ativo");
        expect(html).toContain("Acme");
        expect(html).toContain("/agency/organizations/org-1");
        expect(html).toContain("/agency/commercial/workspaces/ws-1");
        expect(html).toContain("Página 1 de 1");
    });

    test("redirects non-agency access to login", async () => {
        getAuthContextMock.mockResolvedValue({
            isAuthenticated: true,
            authScope: "tenant",
            organizationId: "tenant-org",
            role: "admin",
        });

        await expect(AgencyOrganizationsPage({
            searchParams: Promise.resolve({}),
        })).rejects.toThrow();

        expect(redirectMock).toHaveBeenCalledWith("/agency/login");
    });
});
