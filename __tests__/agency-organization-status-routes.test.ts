const requireAdminApiAccessMock = jest.fn();
const updateOrganizationOperationalStatusMock = jest.fn();

jest.mock("../lib/auth/admin-api-guard", () => ({
    requireAdminApiAccess: requireAdminApiAccessMock,
}));

jest.mock("../lib/repositories/organizationRepository", () => ({
    updateOrganizationOperationalStatus: updateOrganizationOperationalStatusMock,
}));

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: any) => handler,
}));

import { POST as activatePOST } from "../app/api/agency/organizations/[id]/activate/route";
import { POST as suspendPOST } from "../app/api/agency/organizations/[id]/suspend/route";

describe("Agency organization status routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("activates an organization and redirects back to detail", async () => {
        requireAdminApiAccessMock.mockResolvedValue({
            ok: true,
            mode: "session",
            auth: {
                organizationId: "agency-org",
                userId: "user-1",
                role: "admin",
            },
        });
        updateOrganizationOperationalStatusMock.mockResolvedValue({
            organizationId: "org-1",
            organizationName: "Acme",
            previousSubscriptionStatus: "suspended",
            nextSubscriptionStatus: "active",
            previousLifecycleStatus: "suspended",
            nextLifecycleStatus: "active",
            changed: true,
        });

        const response = await activatePOST(
            new Request("http://localhost/api/agency/organizations/org-1/activate", { method: "POST" }) as unknown as import("next/server").NextRequest,
            { params: Promise.resolve({ id: "org-1" }) },
        );

        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toContain("/agency/organizations/org-1");
        expect(updateOrganizationOperationalStatusMock).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-1",
            nextSubscriptionStatus: "active",
            actorUserId: "user-1",
            actorRole: "admin",
            source: "agency_surface",
        }));
    });

    test("blocks suspension outside the Agency scope", async () => {
        requireAdminApiAccessMock.mockResolvedValue({
            ok: false,
            status: 403,
            error: "Forbidden",
        });

        const response = await suspendPOST(
            new Request("http://localhost/api/agency/organizations/org-1/suspend", { method: "POST" }) as unknown as import("next/server").NextRequest,
            { params: Promise.resolve({ id: "org-1" }) },
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({ error: "Forbidden" });
        expect(updateOrganizationOperationalStatusMock).not.toHaveBeenCalled();
    });
});
