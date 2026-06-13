import { POST } from "../app/api/org/[slug]/mobile/actions/route";

const requireOrgContext = jest.fn();
const updateMobileDeal = jest.fn();
const createMobileActivity = jest.fn();

jest.mock("@/lib/auth/org-context", () => ({
    requireOrgContext: (...args: unknown[]) => requireOrgContext(...args),
}));

jest.mock("@/lib/mobile/mobile-actions", () => ({
    MobileActionError: class MobileActionError extends Error {
        status: number;
        code: string;

        constructor(message: string, status: number, code: string) {
            super(message);
            this.status = status;
            this.code = code;
        }
    },
    updateMobileDeal: (...args: unknown[]) => updateMobileDeal(...args),
    createMobileActivity: (...args: unknown[]) => createMobileActivity(...args),
}));

describe("mobile actions route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        requireOrgContext.mockResolvedValue({
            orgId: "org-1",
            orgSlug: "acme",
            userId: "user-1",
            role: "admin",
            plan: "enterprise",
            maxAssessmentsPerMonth: 10,
        });
    });

    it("updates a deal through the tenant-scoped route", async () => {
        updateMobileDeal.mockResolvedValue({
            deal: {
                id: "deal-1",
            },
            noteSaved: true,
        });

        const response = await POST(new Request("http://localhost/api/org/acme/mobile/actions", {
            method: "POST",
            body: JSON.stringify({
                kind: "deal_update",
                dealId: "deal-1",
                status: "closed_won",
            }),
        }), {
            params: Promise.resolve({ slug: "acme" }),
        });

        const payload = await response.json();
        expect(response.status).toBe(200);
        expect(requireOrgContext).toHaveBeenCalledWith("acme");
        expect(updateMobileDeal).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-1",
            dealId: "deal-1",
        }));
        expect(payload.success).toBe(true);
    });

    it("returns a safe error when the tenant is not authorized", async () => {
        requireOrgContext.mockRejectedValueOnce(new Error("FORBIDDEN"));

        const response = await POST(new Request("http://localhost/api/org/acme/mobile/actions", {
            method: "POST",
            body: JSON.stringify({
                kind: "deal_update",
                dealId: "deal-1",
                status: "open",
            }),
        }), {
            params: Promise.resolve({ slug: "acme" }),
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
    });
});

