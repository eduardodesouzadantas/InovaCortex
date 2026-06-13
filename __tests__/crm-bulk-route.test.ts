const requireOrgContextFromRequestMock = jest.fn();
const orgContextErrorResponseMock = jest.fn((error: Error) => Response.json({
    success: false,
    error: error.message,
}, { status: 403 }));
const executeCrmBulkActionMock = jest.fn();
const parseCrmBulkActionInputMock = jest.fn((body: unknown) => {
    if (
        body
        && typeof body === "object"
        && "field" in body
        && "assessmentIds" in body
    ) {
        return {
            success: true,
            data: body,
        };
    }

    return {
        success: false,
        error: {
            flatten: () => ({ fieldErrors: { field: ["invalid"] }, formErrors: [] }),
        },
    };
});

jest.mock("../lib/auth/org-context", () => ({
    requireOrgContextFromRequest: requireOrgContextFromRequestMock,
    orgContextErrorResponse: orgContextErrorResponseMock,
}));

jest.mock("../lib/operator/crm-workspace", () => ({
    executeCrmBulkAction: executeCrmBulkActionMock,
    parseCrmBulkActionInput: parseCrmBulkActionInputMock,
}));

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { POST } from "../app/api/org/[slug]/crm/bulk/route";

describe("CRM bulk route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("executes tenant-safe bulk action for closer role", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            userId: "user-1",
            role: "closer",
            plan: "growth",
        });
        executeCrmBulkActionMock.mockResolvedValue({
            field: "workspace.priority",
            value: "high",
            totalRequested: 2,
            successCount: 2,
            failureCount: 0,
            results: [
                { assessmentId: "assessment-1", success: true },
                { assessmentId: "assessment-2", success: true },
            ],
        });

        const response = await POST(
            new Request("http://localhost/api/org/acme/crm/bulk", {
                method: "POST",
                body: JSON.stringify({
                    assessmentIds: ["assessment-1", "assessment-2"],
                    field: "workspace.priority",
                    value: "high",
                }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                successCount: 2,
            },
        });
        expect(executeCrmBulkActionMock).toHaveBeenCalledWith({
            organizationId: "org-a",
            role: "closer",
            assessmentIds: ["assessment-1", "assessment-2"],
            field: "workspace.priority",
            value: "high",
        });
    });

    test("rejects bulk action for viewer role", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            userId: "user-1",
            role: "viewer",
            plan: "growth",
        });

        const response = await POST(
            new Request("http://localhost/api/org/acme/crm/bulk", {
                method: "POST",
                body: JSON.stringify({
                    assessmentIds: ["assessment-1"],
                    field: "workspace.priority",
                    value: "high",
                }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(403);
        expect(executeCrmBulkActionMock).not.toHaveBeenCalled();
    });

    test("rejects invalid bulk payload before mutation", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            userId: "user-1",
            role: "closer",
            plan: "growth",
        });
        parseCrmBulkActionInputMock.mockReturnValueOnce({
            success: false,
            error: {
                flatten: () => ({ fieldErrors: { field: ["invalid"] }, formErrors: [] }),
            },
        });

        const response = await POST(
            new Request("http://localhost/api/org/acme/crm/bulk", {
                method: "POST",
                body: JSON.stringify({ field: "assessment.scoreTotal", value: "99" }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(400);
        expect(executeCrmBulkActionMock).not.toHaveBeenCalled();
    });
});
