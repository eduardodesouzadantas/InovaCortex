const mockRequireOrgContextFromRequest = jest.fn();
const mockOrgContextErrorResponse = jest.fn((error: unknown) => new Response(String(error), { status: 403 }));
const mockPulseAction = jest.fn();
const mockUserFindUnique = jest.fn();
const mockGetOrganizationAccountStatus = jest.fn();

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock("../lib/auth/org-context", () => ({
    requireOrgContextFromRequest: mockRequireOrgContextFromRequest,
    orgContextErrorResponse: mockOrgContextErrorResponse,
}));

jest.mock("../lib/prisma", () => ({
    prisma: {
        user: {
            findUnique: mockUserFindUnique,
        },
    },
}));

jest.mock("../lib/billing/account-status", () => ({
    getOrganizationAccountStatus: mockGetOrganizationAccountStatus,
    ORGANIZATION_BILLING_SUSPENDED_MESSAGE: "Conta suspensa. Regularize o billing para continuar.",
}));

jest.mock("../lib/executive/pulse-actions", () => ({
    recordExecutivePulseAction: mockPulseAction,
}));

import { POST as pulseActionPOST } from "../app/api/org/[slug]/executive/pulse-actions/route";

describe("Executive pulse actions route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRequireOrgContextFromRequest.mockResolvedValue({
            orgId: "org-1",
            orgSlug: "acme",
            userId: "user-1",
            role: "admin",
        });
        mockUserFindUnique.mockResolvedValue({
            email: "ceo@acme.com",
        });
        mockGetOrganizationAccountStatus.mockResolvedValue("trial");
        mockPulseAction.mockResolvedValue({
            pulseKey: "stalled_deal::proposal stale",
            status: "tracking",
            lastActionAt: "2026-03-18T12:00:00.000Z",
            lastActionBy: "ceo@acme.com",
            linkedEntityType: "deal",
            linkedEntityId: "deal-1",
        });
    });

    it("records a pulse action within the tenant context", async () => {
        const response = await pulseActionPOST(
            new Request("http://localhost/api/org/acme/executive/pulse-actions", {
                method: "POST",
                body: JSON.stringify({
                    pulseKey: "stalled_deal::proposal stale",
                    action: "tracking",
                    linkedEntityType: "deal",
                    linkedEntityId: "deal-1",
                }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(mockRequireOrgContextFromRequest).toHaveBeenCalledWith(expect.any(Request), "acme");
        expect(mockUserFindUnique).toHaveBeenCalledWith({
            where: { id: "user-1" },
            select: { email: true },
        });
        expect(mockPulseAction).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-1",
            pulseKey: "stalled_deal::proposal stale",
            status: "tracking",
            lastActionBy: "ceo@acme.com",
            linkedEntityType: "deal",
            linkedEntityId: "deal-1",
        }));
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                alertState: {
                    pulseKey: "stalled_deal::proposal stale",
                    status: "tracking",
                },
            },
        });
    });

    it("rejects viewers from registering CEO pulse actions", async () => {
        mockRequireOrgContextFromRequest.mockResolvedValueOnce({
            orgId: "org-1",
            orgSlug: "acme",
            userId: "user-1",
            role: "viewer",
        });

        const response = await pulseActionPOST(
            new Request("http://localhost/api/org/acme/executive/pulse-actions", {
                method: "POST",
                body: JSON.stringify({
                    pulseKey: "stalled_deal::proposal stale",
                    action: "tracking",
                }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(403);
        expect(mockPulseAction).not.toHaveBeenCalled();
    });

    it("blocks pulse actions when billing is suspended", async () => {
        mockGetOrganizationAccountStatus.mockResolvedValueOnce("suspended");

        const response = await pulseActionPOST(
            new Request("http://localhost/api/org/acme/executive/pulse-actions", {
                method: "POST",
                body: JSON.stringify({
                    pulseKey: "stalled_deal::proposal stale",
                    action: "tracking",
                }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(403);
        expect(mockPulseAction).not.toHaveBeenCalled();
    });

    it("rejects malformed payloads before persistence", async () => {
        const response = await pulseActionPOST(
            new Request("http://localhost/api/org/acme/executive/pulse-actions", {
                method: "POST",
                body: JSON.stringify({
                    pulseKey: "stalled_deal::proposal stale",
                    action: "tracking",
                    linkedEntityId: "deal-1",
                }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(400);
        expect(mockPulseAction).not.toHaveBeenCalled();
    });
});
