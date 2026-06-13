const mockOrganizationFindUnique = jest.fn();

jest.mock("../lib/prisma", () => ({
    prisma: {
        organization: {
            findUnique: mockOrganizationFindUnique,
        },
    },
}));

import {
    getOrganizationAccountStatus,
    isOrganizationSuspended,
    normalizeOrganizationAccountStatus,
    organizationAccountStatusLabel,
} from "../lib/billing/account-status";

describe("billing account status", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("normalizes legacy subscription statuses into the billing contract", () => {
        expect(normalizeOrganizationAccountStatus("active")).toBe("active");
        expect(normalizeOrganizationAccountStatus("trialing")).toBe("trial");
        expect(normalizeOrganizationAccountStatus("none")).toBe("trial");
        expect(normalizeOrganizationAccountStatus("past_due")).toBe("suspended");
        expect(normalizeOrganizationAccountStatus("canceled")).toBe("suspended");
        expect(isOrganizationSuspended("suspended")).toBe(true);
        expect(organizationAccountStatusLabel("trial")).toBe("Trial");
    });

    it("reads the current organization account status from prisma", async () => {
        mockOrganizationFindUnique.mockResolvedValueOnce({
            subscriptionStatus: "past_due",
        });

        await expect(getOrganizationAccountStatus("org-1")).resolves.toBe("suspended");
        expect(mockOrganizationFindUnique).toHaveBeenCalledWith({
            where: { id: "org-1" },
            select: { subscriptionStatus: true },
        });
    });
});
