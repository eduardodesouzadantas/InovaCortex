const requireAdminApiAccessMock = jest.fn();
const createOrganizationInitialUserMock = jest.fn();
const updateOrganizationUserActiveMock = jest.fn();

jest.mock("../lib/auth/admin-api-guard", () => ({
    requireAdminApiAccess: requireAdminApiAccessMock,
}));

jest.mock("../lib/repositories/organizationUserRepository", () => ({
    createOrganizationInitialUser: createOrganizationInitialUserMock,
    updateOrganizationUserActive: updateOrganizationUserActiveMock,
}));

jest.mock("../lib/logger", () => ({
    logger: {
        warn: jest.fn(),
    },
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { POST as createUserPOST } from "../app/api/agency/organizations/[id]/users/route";
import { POST as activateUserPOST } from "../app/api/agency/organizations/[id]/users/[userId]/activate/route";
import { POST as deactivateUserPOST } from "../app/api/agency/organizations/[id]/users/[userId]/deactivate/route";

describe("Agency organization user routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("creates the initial organization user and redirects back to detail", async () => {
        requireAdminApiAccessMock.mockResolvedValue({
            ok: true,
            mode: "session",
            auth: {
                organizationId: "agency-org",
                userId: "agency-user-1",
                role: "admin",
            },
        });
        createOrganizationInitialUserMock.mockResolvedValue({
            ok: true,
            organizationId: "org-1",
            organizationName: "Acme",
            user: {
                id: "user-1",
                email: "admin@acme.com",
                role: "owner",
                active: true,
                createdAt: "2026-03-22T10:00:00.000Z",
            },
        });

        const response = await createUserPOST(
            new Request("http://localhost/api/agency/organizations/org-1/users", {
                method: "POST",
                body: new URLSearchParams({
                    email: "admin@acme.com",
                    password: "initial-pass",
                }),
            }) as unknown as import("next/server").NextRequest,
            { params: Promise.resolve({ id: "org-1" }) },
        );

        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toContain("/agency/organizations/org-1");
        expect(response.headers.get("location")).toContain("userAction=created");
        expect(createOrganizationInitialUserMock).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-1",
            email: "admin@acme.com",
            password: "initial-pass",
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
        }));
    });

    test("activates an organization user and redirects back to detail", async () => {
        requireAdminApiAccessMock.mockResolvedValue({
            ok: true,
            mode: "session",
            auth: {
                organizationId: "agency-org",
                userId: "agency-user-1",
                role: "admin",
            },
        });
        updateOrganizationUserActiveMock.mockResolvedValue({
            ok: true,
            organizationId: "org-1",
            organizationName: "Acme",
            user: {
                id: "user-2",
                email: "owner@acme.com",
                role: "owner",
                active: true,
                createdAt: "2026-03-22T10:00:00.000Z",
            },
            changed: true,
            previousActive: false,
        });

        const response = await activateUserPOST(
            new Request("http://localhost/api/agency/organizations/org-1/users/user-2/activate", { method: "POST" }) as unknown as import("next/server").NextRequest,
            { params: Promise.resolve({ id: "org-1", userId: "user-2" }) },
        );

        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toContain("/agency/organizations/org-1");
        expect(response.headers.get("location")).toContain("userAction=activated");
        expect(updateOrganizationUserActiveMock).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-1",
            userId: "user-2",
            nextActive: true,
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
        }));
    });

    test("deactivates an organization user and redirects back to detail", async () => {
        requireAdminApiAccessMock.mockResolvedValue({
            ok: true,
            mode: "session",
            auth: {
                organizationId: "agency-org",
                userId: "agency-user-1",
                role: "admin",
            },
        });
        updateOrganizationUserActiveMock.mockResolvedValue({
            ok: true,
            organizationId: "org-1",
            organizationName: "Acme",
            user: {
                id: "user-2",
                email: "owner@acme.com",
                role: "owner",
                active: false,
                createdAt: "2026-03-22T10:00:00.000Z",
            },
            changed: true,
            previousActive: true,
        });

        const response = await deactivateUserPOST(
            new Request("http://localhost/api/agency/organizations/org-1/users/user-2/deactivate", { method: "POST" }) as unknown as import("next/server").NextRequest,
            { params: Promise.resolve({ id: "org-1", userId: "user-2" }) },
        );

        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toContain("/agency/organizations/org-1");
        expect(response.headers.get("location")).toContain("userAction=deactivated");
        expect(updateOrganizationUserActiveMock).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-1",
            userId: "user-2",
            nextActive: false,
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
        }));
    });

    test("blocks user management outside the Agency admin scope", async () => {
        requireAdminApiAccessMock.mockResolvedValue({
            ok: false,
            status: 403,
            error: "Forbidden",
        });

        const response = await createUserPOST(
            new Request("http://localhost/api/agency/organizations/org-1/users", {
                method: "POST",
                body: new URLSearchParams({
                    email: "admin@acme.com",
                    password: "initial-pass",
                }),
            }) as unknown as import("next/server").NextRequest,
            { params: Promise.resolve({ id: "org-1" }) },
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({ error: "Forbidden" });
        expect(createOrganizationInitialUserMock).not.toHaveBeenCalled();
    });
});
