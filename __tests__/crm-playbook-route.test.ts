const requireOrgContextFromRequestMock = jest.fn();
const orgContextErrorResponseMock = jest.fn((error: Error) => Response.json({
    success: false,
    error: error.message,
}, { status: 403 }));
const executeCrmPlaybookMock = jest.fn();
const parseCrmPlaybookInputMock = jest.fn((body: unknown) => {
    if (
        body
        && typeof body === "object"
        && "playbookId" in body
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
            flatten: () => ({ fieldErrors: { playbookId: ["invalid"] }, formErrors: [] }),
        },
    };
});

jest.mock("../lib/auth/org-context", () => ({
    requireOrgContextFromRequest: requireOrgContextFromRequestMock,
    orgContextErrorResponse: orgContextErrorResponseMock,
}));

jest.mock("../lib/operator/crm-workspace", () => ({
    executeCrmPlaybook: executeCrmPlaybookMock,
    parseCrmPlaybookInput: parseCrmPlaybookInputMock,
}));

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { POST } from "../app/api/org/[slug]/crm/playbooks/route";

describe("CRM playbook route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("executes a contextual playbook for closer role", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            userId: "user-1",
            role: "closer",
            plan: "growth",
        });
        executeCrmPlaybookMock.mockResolvedValue({
            playbookId: "follow-up-initial",
            totalRequested: 1,
            successCount: 1,
            failureCount: 0,
            results: [{ assessmentId: "assessment-1", success: true, cadenceLabel: "Cadencia de follow-up inicial · passo 1/3" }],
        });

        const response = await POST(
            new Request("http://localhost/api/org/acme/crm/playbooks", {
                method: "POST",
                body: JSON.stringify({
                    assessmentIds: ["assessment-1"],
                    playbookId: "follow-up-initial",
                    sourceViewId: "follow-up",
                }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                successCount: 1,
            },
        });
        expect(executeCrmPlaybookMock).toHaveBeenCalledWith({
            organizationId: "org-a",
            role: "closer",
            assessmentIds: ["assessment-1"],
            playbookId: "follow-up-initial",
            sourceViewId: "follow-up",
        });
    });

    test("rejects playbook execution for viewer role", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            userId: "user-1",
            role: "viewer",
            plan: "growth",
        });

        const response = await POST(
            new Request("http://localhost/api/org/acme/crm/playbooks", {
                method: "POST",
                body: JSON.stringify({
                    assessmentIds: ["assessment-1"],
                    playbookId: "follow-up-initial",
                }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(403);
        expect(executeCrmPlaybookMock).not.toHaveBeenCalled();
    });

    test("rejects invalid playbook payload before execution", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            userId: "user-1",
            role: "closer",
            plan: "growth",
        });

        const response = await POST(
            new Request("http://localhost/api/org/acme/crm/playbooks", {
                method: "POST",
                body: JSON.stringify({
                    assessmentIds: ["assessment-1"],
                }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "INVALID_INPUT",
        });
        expect(executeCrmPlaybookMock).not.toHaveBeenCalled();
    });
});
