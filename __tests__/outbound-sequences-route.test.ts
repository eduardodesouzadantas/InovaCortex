const requireOrgContextMock = jest.fn();
const startOutboundSequenceMock = jest.fn();

jest.mock("../lib/auth/org-context", () => ({
    requireOrgContext: requireOrgContextMock,
}));

jest.mock("../lib/outbound/outbound-engine", () => ({
    startOutboundSequence: startOutboundSequenceMock,
}));

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import type { NextRequest } from "next/server";
import { POST } from "../app/api/org/[slug]/outbound/sequences/route";

describe("Outbound sequence route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("denies viewers from starting outbound sequences", async () => {
        requireOrgContextMock.mockResolvedValue({
            orgId: "org-a",
            role: "viewer",
        });

        const response = await POST(
            new Request("http://localhost/api/org/org-a/outbound/sequences", {
                method: "POST",
                body: JSON.stringify({ prospectId: "prospect-1" }),
            }) as unknown as NextRequest,
            { params: Promise.resolve({ slug: "org-a" }) },
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "FORBIDDEN",
        });
        expect(startOutboundSequenceMock).not.toHaveBeenCalled();
    });

    test("returns not found when the prospect is outside the organization scope", async () => {
        requireOrgContextMock.mockResolvedValue({
            orgId: "org-a",
            role: "admin",
        });
        startOutboundSequenceMock.mockRejectedValue(new Error("PROSPECT_NOT_FOUND"));

        const response = await POST(
            new Request("http://localhost/api/org/org-a/outbound/sequences", {
                method: "POST",
                body: JSON.stringify({ prospectId: "prospect-2" }),
            }) as unknown as NextRequest,
            { params: Promise.resolve({ slug: "org-a" }) },
        );

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "NOT_FOUND",
        });
    });
});
