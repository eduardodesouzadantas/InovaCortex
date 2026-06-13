const agencyPostMock = jest.fn();

jest.mock("../lib/auth/session", () => ({
    getAgencyOrgSlug: () => "inovacortex",
}));

jest.mock("../app/api/agency/builder/run/route", () => ({
    POST: agencyPostMock,
    GET: jest.fn(),
}));

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import type { NextRequest } from "next/server";
import { POST } from "../app/api/org/[slug]/builder/run/route";

describe("Legacy builder tenant adapter", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("blocks tenant slugs outside agency scope with deprecation metadata", async () => {
        const response = await POST(
            new Request("http://localhost/api/org/tenant-a/builder/run", { method: "POST" }) as unknown as NextRequest,
            { params: Promise.resolve({ slug: "tenant-a" }) },
        );

        expect(response.status).toBe(403);
        expect(response.headers.get("X-Inova-Legacy-Adapter")).toBe("builder-tenant-route");
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "FORBIDDEN",
            message: "Builder moved to agency scope",
        });
        expect(agencyPostMock).not.toHaveBeenCalled();
    });
});
