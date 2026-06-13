const mockOrganizationCount = jest.fn();
const mockOrganizationFindMany = jest.fn();
const mockOrganizationFindUnique = jest.fn();
const mockOrganizationUpdate = jest.fn();
const mockClientWorkspaceFindMany = jest.fn();
const mockUserFindMany = jest.fn();
const mockUserInviteFindMany = jest.fn();
const mockAuditEventCreate = jest.fn();
const mockTransaction = jest.fn(async (callback: (tx: any) => Promise<any>) => callback({
    organization: {
        findUnique: mockOrganizationFindUnique,
        update: mockOrganizationUpdate,
    },
    clientWorkspace: {
        findMany: mockClientWorkspaceFindMany,
    },
    user: {
        findMany: mockUserFindMany,
    },
    userInvite: {
        findMany: mockUserInviteFindMany,
    },
    auditEvent: {
        create: mockAuditEventCreate,
    },
}));

jest.mock("../lib/prisma", () => ({
    prisma: {
        organization: {
            count: mockOrganizationCount,
            findMany: mockOrganizationFindMany,
            findUnique: mockOrganizationFindUnique,
            update: mockOrganizationUpdate,
        },
        clientWorkspace: {
            findMany: mockClientWorkspaceFindMany,
        },
        user: {
            findMany: mockUserFindMany,
        },
        userInvite: {
            findMany: mockUserInviteFindMany,
        },
        auditEvent: {
            create: mockAuditEventCreate,
        },
        $transaction: mockTransaction,
    },
}));

import {
    buildOrganizationLifecycleWhere,
    deriveOrganizationLifecycleStatus,
    getOrganizationDetails,
    listOrganizations,
    normalizeOrganizationLifecycleFilter,
    updateOrganizationOperationalStatus,
} from "../lib/repositories/organizationRepository";

describe("organizationRepository", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("normalizes and derives lifecycle status", () => {
        expect(normalizeOrganizationLifecycleFilter("active")).toBe("active");
        expect(normalizeOrganizationLifecycleFilter("suspended")).toBe("suspended");
        expect(normalizeOrganizationLifecycleFilter("onboarding")).toBe("onboarding");
        expect(normalizeOrganizationLifecycleFilter("invalid")).toBe("all");

        expect(deriveOrganizationLifecycleStatus({
            subscriptionStatus: "suspended",
            onboardingStatus: "completed",
        })).toBe("suspended");

        expect(deriveOrganizationLifecycleStatus({
            subscriptionStatus: "trial",
            onboardingStatus: "completed",
        })).toBe("active");

        expect(deriveOrganizationLifecycleStatus({
            subscriptionStatus: "trial",
            onboardingStatus: null,
        })).toBe("onboarding");
    });

    test("builds lifecycle filters for list queries", () => {
        expect(buildOrganizationLifecycleWhere("suspended")).toEqual(expect.objectContaining({
            subscriptionStatus: {
                in: expect.arrayContaining(["suspended", "paused", "past_due"]),
            },
        }));

        expect(buildOrganizationLifecycleWhere("active")).toEqual(expect.objectContaining({
            onboardingStatus: {
                is: {
                    status: "completed",
                },
            },
        }));

        expect(buildOrganizationLifecycleWhere("onboarding")).toEqual(expect.objectContaining({
            OR: expect.any(Array),
        }));
    });

    test("lists organizations with latest workspace enrichment", async () => {
        mockOrganizationCount.mockResolvedValue(2);
        mockOrganizationFindMany.mockResolvedValue([
            {
                id: "org-1",
                name: "Acme",
                slug: "acme",
                plan: "growth",
                industry: "Services",
                maxUsers: 5,
                subscriptionStatus: "trial",
                createdAt: new Date("2026-03-16T10:00:00.000Z"),
                updatedAt: new Date("2026-03-16T11:00:00.000Z"),
                onboardingStatus: { status: "completed", updatedAt: new Date("2026-03-16T11:30:00.000Z") },
                _count: { users: 3, agencyMemberships: 1, organizationAccesses: 2 },
            },
            {
                id: "org-2",
                name: "Globex",
                slug: "globex",
                plan: "enterprise",
                industry: "Finance",
                maxUsers: 20,
                subscriptionStatus: "suspended",
                createdAt: new Date("2026-03-15T10:00:00.000Z"),
                updatedAt: new Date("2026-03-15T11:00:00.000Z"),
                onboardingStatus: { status: "in_progress", updatedAt: new Date("2026-03-15T11:30:00.000Z") },
                _count: { users: 7, agencyMemberships: 2, organizationAccesses: 3 },
            },
        ]);
        mockClientWorkspaceFindMany.mockResolvedValue([
            {
                id: "ws-1",
                organizationId: "org-1",
                status: "active",
                createdAt: new Date("2026-03-17T09:00:00.000Z"),
                goLiveAt: new Date("2026-03-17T10:00:00.000Z"),
                proposalId: "proposal-1",
                assessmentId: "assessment-1",
            },
            {
                id: "ws-2",
                organizationId: "org-2",
                status: "provisioning",
                createdAt: new Date("2026-03-17T08:00:00.000Z"),
                goLiveAt: null,
                proposalId: "proposal-2",
                assessmentId: "assessment-2",
            },
        ]);

        const result = await listOrganizations({
            page: 1,
            limit: 20,
            status: "all",
        });

        expect(mockOrganizationCount).toHaveBeenCalledWith({ where: {} });
        expect(mockOrganizationFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {},
            skip: 0,
            take: 20,
        }));
        expect(result.pagination.total).toBe(2);
        expect(result.organizations[0]).toEqual(expect.objectContaining({
            id: "org-1",
            lifecycleStatus: "active",
            latestWorkspace: expect.objectContaining({
                id: "ws-1",
                status: "active",
            }),
        }));
        expect(result.organizations[1]).toEqual(expect.objectContaining({
            lifecycleStatus: "suspended",
        }));
    });

    test("loads organization details without touching provisioning state", async () => {
        mockOrganizationFindUnique.mockResolvedValue({
            id: "org-1",
            name: "Acme",
            slug: "acme",
            plan: "growth",
            industry: "Services",
            maxUsers: 5,
            subscriptionStatus: "trial",
            createdAt: new Date("2026-03-16T10:00:00.000Z"),
            updatedAt: new Date("2026-03-16T11:00:00.000Z"),
            onboardingStatus: {
                status: "completed",
                emailConnectedAt: new Date("2026-03-16T10:10:00.000Z"),
                pipelineConfiguredAt: new Date("2026-03-16T10:20:00.000Z"),
                firstContactAt: new Date("2026-03-16T10:30:00.000Z"),
                firstDealAt: new Date("2026-03-16T10:40:00.000Z"),
                completedAt: new Date("2026-03-16T10:40:00.000Z"),
                updatedAt: new Date("2026-03-16T10:40:00.000Z"),
            },
            _count: {
                users: 2,
                agencyMemberships: 1,
                organizationAccesses: 1,
            },
        });
        mockUserFindMany.mockResolvedValue([
            {
                id: "user-1",
                name: "Admin Acme",
                email: "admin@acme.com",
                role: "admin",
                createdAt: new Date("2026-03-16T10:05:00.000Z"),
                lastAccessAt: new Date("2026-03-16T11:15:00.000Z"),
            },
        ]);
        mockClientWorkspaceFindMany.mockResolvedValue([
            {
                id: "ws-1",
                organizationId: "org-1",
                status: "active",
                createdAt: new Date("2026-03-17T09:00:00.000Z"),
                goLiveAt: new Date("2026-03-17T10:00:00.000Z"),
                proposalId: "proposal-1",
                assessmentId: "assessment-1",
            },
        ]);
        mockUserInviteFindMany.mockResolvedValue([
            {
                id: "invite-1",
                organizationId: "org-1",
                email: "invitee@acme.com",
                role: "viewer",
                expiresAt: new Date("2026-03-25T10:00:00.000Z"),
                acceptedAt: null,
                revokedAt: null,
                createdByUserId: "agency-user-1",
                createdAt: new Date("2026-03-24T10:00:00.000Z"),
            },
        ]);

        const result = await getOrganizationDetails("org-1");

        expect(result).not.toBeNull();
        expect(result?.counts.workspaces).toBe(1);
        expect(result?.subscriptionStatusLabel).toBe("Trial");
        expect(result?.lifecycleStatus).toBe("active");
        expect(result?.users[0]).toEqual(expect.objectContaining({
            name: "Admin Acme",
            email: "admin@acme.com",
            role: "admin",
            lastAccessAt: "2026-03-16T11:15:00.000Z",
        }));
        expect(result?.invites[0]).toEqual(expect.objectContaining({
            email: "invitee@acme.com",
            role: "viewer",
            status: "pending",
        }));
        expect(mockOrganizationFindUnique).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "org-1" },
        }));
        expect(mockUserFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { organizationId: "org-1" },
            take: 10,
        }));
    });

    test("updates organization operational status with audit trail", async () => {
        mockOrganizationFindUnique.mockResolvedValueOnce({
            id: "org-1",
            name: "Acme",
            subscriptionStatus: "suspended",
            onboardingStatus: { status: "completed" },
        });
        mockOrganizationUpdate.mockResolvedValueOnce({
            id: "org-1",
            name: "Acme",
            subscriptionStatus: "active",
            onboardingStatus: { status: "completed" },
        });
        mockAuditEventCreate.mockResolvedValueOnce({
            id: "audit-1",
        });

        const result = await updateOrganizationOperationalStatus({
            organizationId: "org-1",
            nextSubscriptionStatus: "active",
            actorUserId: "user-1",
            actorRole: "admin",
            source: "agency_surface",
        });

        expect(result).toEqual(expect.objectContaining({
            organizationId: "org-1",
            previousSubscriptionStatus: "suspended",
            nextSubscriptionStatus: "active",
            changed: true,
        }));
        expect(mockOrganizationUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "org-1" },
            data: { subscriptionStatus: "active" },
        }));
        expect(mockAuditEventCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                organizationId: "org-1",
                action: "agencyOrganization:statusChanged",
            }),
        }));
    });
});
