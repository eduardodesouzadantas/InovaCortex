jest.mock("next/link", () => {
    const ReactModule = jest.requireActual<typeof import("react")>("react");
    return {
        __esModule: true,
        default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
            ReactModule.createElement("a", { href, ...props }, children),
    };
});

const getAuthContextMock = jest.fn();
const getOrganizationDetailsMock = jest.fn();

jest.mock("../lib/auth/session", () => ({
    getAuthContext: getAuthContextMock,
}));

jest.mock("../lib/repositories/organizationRepository", () => ({
    getOrganizationDetails: getOrganizationDetailsMock,
    getOrganizationLifecycleStatusClassName: (status: string) => status,
    getOrganizationLifecycleStatusLabel: (status: string) => ({ active: "Ativo", suspended: "Suspenso", onboarding: "Onboarding" } as Record<string, string>)[status] ?? status,
    getOrganizationSubscriptionStatusClassName: (status: string) => status,
    getOrganizationSubscriptionStatusLabel: (status: string) => ({ active: "Ativa", trial: "Trial", suspended: "Suspensa" } as Record<string, string>)[status] ?? status,
}));

import { renderToStaticMarkup } from "react-dom/server";

import AgencyOrganizationDetailPage from "../app/agency/organizations/[id]/page";

describe("AgencyOrganizationDetailPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("renders a read-only organization detail surface with suspension action", async () => {
        getAuthContextMock.mockResolvedValue({
            isAuthenticated: true,
            authScope: "agency",
            organizationId: "agency-org",
            role: "admin",
        });
        getOrganizationDetailsMock.mockResolvedValue({
            id: "org-1",
            name: "Acme",
            slug: "acme",
            plan: "growth",
            industry: "Services",
            maxUsers: 5,
            subscriptionStatus: "trial",
            normalizedSubscriptionStatus: "trial",
            subscriptionStatusLabel: "Trial",
            lifecycleStatus: "active",
            createdAt: "2026-03-16T10:00:00.000Z",
            updatedAt: "2026-03-16T11:00:00.000Z",
            onboarding: {
                status: "completed",
                emailConnectedAt: "2026-03-16T10:10:00.000Z",
                pipelineConfiguredAt: "2026-03-16T10:20:00.000Z",
                firstContactAt: "2026-03-16T10:30:00.000Z",
                firstDealAt: "2026-03-16T10:40:00.000Z",
                completedAt: "2026-03-16T10:40:00.000Z",
                updatedAt: "2026-03-16T10:40:00.000Z",
            },
            counts: {
                users: 2,
                agencyMemberships: 1,
                organizationAccesses: 1,
                workspaces: 1,
            },
            users: [
                {
                    id: "user-1",
                    email: "admin@acme.com",
                    role: "admin",
                    active: true,
                    createdAt: "2026-03-16T10:05:00.000Z",
                },
            ],
            workspaces: [
                {
                    id: "ws-1",
                    status: "active",
                    createdAt: "2026-03-17T09:00:00.000Z",
                    goLiveAt: "2026-03-17T10:00:00.000Z",
                    proposalId: "proposal-1",
                    assessmentId: "assessment-1",
                },
            ],
        });

        const element = await AgencyOrganizationDetailPage({
            params: Promise.resolve({ id: "org-1" }),
            searchParams: Promise.resolve({}),
        });
        const html = renderToStaticMarkup(element as React.ReactElement);

        expect(html).toContain("Acme");
        expect(html).toContain("Organizations");
        expect(html).toContain("Ativo");
        expect(html).toContain("Trial");
        expect(html).toContain("Suspender organizacao");
        expect(html).toContain("Nome");
        expect(html).toContain("Último acesso");
        expect(html).toContain("admin@acme.com");
        expect(html).toContain("Desativar usuario");
        expect(html).toContain("/agency/commercial/workspaces/ws-1");
    });

    test("renders activation action for suspended organizations", async () => {
        getAuthContextMock.mockResolvedValue({
            isAuthenticated: true,
            authScope: "agency",
            organizationId: "agency-org",
            role: "admin",
        });
        getOrganizationDetailsMock.mockResolvedValue({
            id: "org-2",
            name: "Globex",
            slug: "globex",
            plan: "growth",
            industry: "Finance",
            maxUsers: 5,
            subscriptionStatus: "suspended",
            normalizedSubscriptionStatus: "suspended",
            subscriptionStatusLabel: "Suspensa",
            lifecycleStatus: "suspended",
            createdAt: "2026-03-16T10:00:00.000Z",
            updatedAt: "2026-03-16T11:00:00.000Z",
            onboarding: {
                status: "completed",
                emailConnectedAt: null,
                pipelineConfiguredAt: null,
                firstContactAt: null,
                firstDealAt: null,
                completedAt: null,
                updatedAt: null,
            },
            counts: {
                users: 0,
                agencyMemberships: 0,
                organizationAccesses: 0,
                workspaces: 0,
            },
            users: [],
            workspaces: [],
        });

        const element = await AgencyOrganizationDetailPage({
            params: Promise.resolve({ id: "org-2" }),
            searchParams: Promise.resolve({}),
        });
        const html = renderToStaticMarkup(element as React.ReactElement);

        expect(html).toContain("Globex");
        expect(html).toContain("Ativar organizacao");
        expect(html).toContain("Nenhum usuario cadastrado");
        expect(html).toContain("Acesso inicial");
        expect(html).toContain("Criar usuario inicial");
    });
});
