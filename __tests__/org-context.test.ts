const getAuthContextMock = jest.fn();
const getAuthContextFromRequestMock = jest.fn();
const resolveAuthContextMock = jest.fn();

const prismaMock = {
    organization: {
        findUnique: jest.fn(),
    },
    user: {
        findUnique: jest.fn(),
    },
    agencyMembership: {
        findFirst: jest.fn(),
    },
    organizationAccess: {
        findFirst: jest.fn(),
    },
};

jest.mock("../lib/prisma", () => ({
    prisma: prismaMock,
}));

jest.mock("../lib/auth/session", () => ({
    getAuthContext: getAuthContextMock,
    getAuthContextFromRequest: getAuthContextFromRequestMock,
    resolveAuthContext: resolveAuthContextMock,
}));

import type { NextRequest } from "next/server";
import { requireOrgContextFromRequest, resolveOrgContextFromAgencySession } from "../lib/auth/org-context";

describe("Org context isolation", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("denies cross-org tenant access when slug does not match session context", async () => {
        getAuthContextFromRequestMock.mockResolvedValue({
            isAuthenticated: true,
            authScope: "tenant",
            organizationId: "org-a-id",
            organizationSlug: "org-a",
            userId: "user-1",
            role: "admin",
            session: {
                userId: "user-1",
                orgId: "org-a-id",
                orgSlug: "org-a",
                role: "admin",
            },
        });

        await expect(requireOrgContextFromRequest({} as NextRequest, "org-b")).rejects.toThrow("FORBIDDEN");
        expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
    });

    test("resolves tenant context when session and slug belong to the same organization", async () => {
        getAuthContextFromRequestMock.mockResolvedValue({
            isAuthenticated: true,
            authScope: "tenant",
            organizationId: "org-a-id",
            organizationSlug: "org-a",
            userId: "user-1",
            role: "admin",
            session: {
                userId: "user-1",
                orgId: "org-a-id",
                orgSlug: "org-a",
                role: "admin",
            },
        });
        prismaMock.user.findUnique.mockResolvedValue({
            active: true,
            organizationId: "org-a-id",
        });
        prismaMock.organization.findUnique.mockResolvedValue({
            id: "org-a-id",
            slug: "org-a",
            plan: "pro",
            maxAssessmentsPerMonth: 100,
            subscriptionStatus: "trial",
        });

        await expect(requireOrgContextFromRequest({} as NextRequest, "org-a")).resolves.toEqual({
            orgId: "org-a-id",
            orgSlug: "org-a",
            userId: "user-1",
            role: "admin",
            plan: "pro",
            maxAssessmentsPerMonth: 100,
            subscriptionStatus: "trial",
        });
    });

    test("denies tenant access when the current user is inactive", async () => {
        getAuthContextFromRequestMock.mockResolvedValue({
            isAuthenticated: true,
            authScope: "tenant",
            organizationId: "org-a-id",
            organizationSlug: "org-a",
            userId: "user-1",
            role: "admin",
            session: {
                userId: "user-1",
                orgId: "org-a-id",
                orgSlug: "org-a",
                role: "admin",
            },
        });
        prismaMock.user.findUnique.mockResolvedValue({
            active: false,
            organizationId: "org-a-id",
        });
        prismaMock.organization.findUnique.mockResolvedValue({
            id: "org-a-id",
            slug: "org-a",
            plan: "pro",
            maxAssessmentsPerMonth: 100,
            subscriptionStatus: "trial",
        });

        await expect(requireOrgContextFromRequest({} as NextRequest, "org-a")).rejects.toThrow("FORBIDDEN");
    });

    test("denies agency session access when membership lacks explicit organization access", async () => {
        prismaMock.organization.findUnique.mockResolvedValue({
            id: "tenant-1",
            slug: "tenant-a",
            plan: "growth",
            maxAssessmentsPerMonth: 50,
        });
        prismaMock.agencyMembership.findFirst.mockResolvedValue({ id: "membership-1" });
        prismaMock.organizationAccess.findFirst.mockResolvedValue(null);

        await expect(resolveOrgContextFromAgencySession("tenant-a", {
            isAuthenticated: true,
            authScope: "agency",
            organizationId: "agency-org",
            organizationSlug: "inovacortex",
            userId: "agency-user",
            role: "admin",
            session: {
                userId: "agency-user",
                orgId: "agency-org",
                orgSlug: "inovacortex",
                role: "admin",
            },
        })).rejects.toThrow("FORBIDDEN");
    });
});
