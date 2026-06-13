const requireOrgContextMock = jest.fn();

const prismaMock = {
    salesRep: {
        findFirst: jest.fn(),
        update: jest.fn(),
    },
};

jest.mock("../lib/auth/org-context", () => ({
    requireOrgContext: requireOrgContextMock,
}));

jest.mock("../lib/prisma", () => ({
    prisma: prismaMock,
}));

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { PATCH } from "../app/api/org/[slug]/sales/reps/[id]/route";

describe("Sales rep route tenant guards", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("denies non-admin mutation attempts", async () => {
        requireOrgContextMock.mockResolvedValue({
            orgId: "org-a",
            role: "viewer",
        });

        const response = await PATCH(
            new Request("http://localhost/api/org/org-a/sales/reps/rep-1", {
                method: "PATCH",
                body: JSON.stringify({ name: "Alice" }),
            }),
            { params: Promise.resolve({ slug: "org-a", id: "rep-1" }) },
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "FORBIDDEN",
        });
        expect(prismaMock.salesRep.findFirst).not.toHaveBeenCalled();
    });

    test("returns not found when the resource is outside the current organization scope", async () => {
        requireOrgContextMock.mockResolvedValue({
            orgId: "org-a",
            role: "admin",
        });
        prismaMock.salesRep.findFirst.mockResolvedValue(null);

        const response = await PATCH(
            new Request("http://localhost/api/org/org-a/sales/reps/rep-2", {
                method: "PATCH",
                body: JSON.stringify({ active: true }),
            }),
            { params: Promise.resolve({ slug: "org-a", id: "rep-2" }) },
        );

        expect(response.status).toBe(404);
        expect(prismaMock.salesRep.findFirst).toHaveBeenCalledWith({
            where: { id: "rep-2", organizationId: "org-a" },
            select: { id: true },
        });
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "NOT_FOUND",
        });
    });
});
