const requireOrgContextMock = jest.fn();

const prismaMock = {
    actionQueue: {
        create: jest.fn(),
    },
};

jest.mock("../lib/auth/org-context", () => ({
    requireOrgContext: requireOrgContextMock,
}));

jest.mock("../lib/prisma", () => ({
    prisma: prismaMock,
}));

jest.mock("../lib/logger", () => ({
    logger: {
        info: jest.fn(),
    },
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { POST } from "../app/api/org/[slug]/performance/recalc/route";

describe("Performance recalc route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("denies non-admin access", async () => {
        requireOrgContextMock.mockResolvedValue({
            orgId: "org-a",
            role: "closer",
            userId: "user-1",
        });

        const response = await POST(
            new Request("http://localhost/api/org/org-a/performance/recalc", { method: "POST" }),
            { params: Promise.resolve({ slug: "org-a" }) },
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "FORBIDDEN",
        });
        expect(prismaMock.actionQueue.create).not.toHaveBeenCalled();
    });

    test("rejects invalid window values before enqueueing work", async () => {
        requireOrgContextMock.mockResolvedValue({
            orgId: "org-a",
            role: "admin",
            userId: "user-1",
        });

        const response = await POST(
            new Request("http://localhost/api/org/org-a/performance/recalc?window=365d", { method: "POST" }),
            { params: Promise.resolve({ slug: "org-a" }) },
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "INVALID_INPUT",
        });
        expect(prismaMock.actionQueue.create).not.toHaveBeenCalled();
    });
});
