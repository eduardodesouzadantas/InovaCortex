const requireOrgContextFromRequestMock = jest.fn();
const orgContextErrorResponseMock = jest.fn((error: Error) => Response.json({
    success: false,
    error: error.message,
}, { status: 403 }));
const buildOperatorCrmRecordDetailMock = jest.fn();
const updateCrmInlineFieldMock = jest.fn();
const parseCrmInlinePatchInputMock = jest.fn((body: unknown) => {
    if (
        body
        && typeof body === "object"
        && "field" in body
        && typeof (body as { field?: unknown }).field === "string"
        && [
            "assessment.status",
            "assessment.goal",
            "contact.lifecycle",
            "deal.stageId",
            "conversation.assignedUserId",
            "workspace.priority",
            "workspace.nextAction",
            "workspace.nextActionAt",
        ].includes((body as { field: string }).field)
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
    buildOperatorCrmRecordDetail: buildOperatorCrmRecordDetailMock,
    parseCrmInlinePatchInput: parseCrmInlinePatchInputMock,
    updateCrmInlineField: updateCrmInlineFieldMock,
}));

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { GET, PATCH } from "../app/api/org/[slug]/crm/records/[assessmentId]/route";

describe("CRM record route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("returns record detail for authorized operator access", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            role: "viewer",
            plan: "growth",
        });
        buildOperatorCrmRecordDetailMock.mockResolvedValue({
            id: "assessment-1",
            company: "Acme",
        });

        const response = await GET(
            new Request("http://localhost/api/org/acme/crm/records/assessment-1") as any,
            { params: Promise.resolve({ slug: "acme", assessmentId: "assessment-1" }) },
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                id: "assessment-1",
                company: "Acme",
            },
        });
        expect(buildOperatorCrmRecordDetailMock).toHaveBeenCalledWith({
            organizationId: "org-a",
            orgSlug: "acme",
            assessmentId: "assessment-1",
        });
    });

    test("rejects inline update for viewer role", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            role: "viewer",
            plan: "growth",
        });

        const response = await PATCH(
            new Request("http://localhost/api/org/acme/crm/records/assessment-1", {
                method: "PATCH",
                body: JSON.stringify({ field: "assessment.status", value: "Contatado" }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme", assessmentId: "assessment-1" }) },
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "FORBIDDEN",
        });
        expect(updateCrmInlineFieldMock).not.toHaveBeenCalled();
    });

    test("executes inline update for closer role", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            role: "closer",
            plan: "growth",
        });
        updateCrmInlineFieldMock.mockResolvedValue({
            assessmentId: "assessment-1",
            field: "deal.stageId",
            value: "stage-2",
            conversationId: "conv-1",
        });

        const response = await PATCH(
            new Request("http://localhost/api/org/acme/crm/records/assessment-1", {
                method: "PATCH",
                body: JSON.stringify({ field: "deal.stageId", value: "stage-2" }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme", assessmentId: "assessment-1" }) },
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                field: "deal.stageId",
                value: "stage-2",
            },
        });
        expect(updateCrmInlineFieldMock).toHaveBeenCalledWith({
            organizationId: "org-a",
            role: "closer",
            assessmentId: "assessment-1",
            field: "deal.stageId",
            value: "stage-2",
        });
    });

    test("accepts controlled qualification fields from the central schema", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            role: "closer",
            plan: "growth",
        });
        updateCrmInlineFieldMock.mockResolvedValue({
            assessmentId: "assessment-1",
            field: "assessment.goal",
            value: "Reduzir tempo de resposta",
            conversationId: "conv-1",
        });

        const response = await PATCH(
            new Request("http://localhost/api/org/acme/crm/records/assessment-1", {
                method: "PATCH",
                body: JSON.stringify({ field: "assessment.goal", value: "Reduzir tempo de resposta" }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme", assessmentId: "assessment-1" }) },
        );

        expect(response.status).toBe(200);
        expect(updateCrmInlineFieldMock).toHaveBeenCalledWith({
            organizationId: "org-a",
            role: "closer",
            assessmentId: "assessment-1",
            field: "assessment.goal",
            value: "Reduzir tempo de resposta",
        });
    });

    test("rejects inline fields outside the allowed schema", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            role: "closer",
            plan: "growth",
        });

        const response = await PATCH(
            new Request("http://localhost/api/org/acme/crm/records/assessment-1", {
                method: "PATCH",
                body: JSON.stringify({ field: "assessment.scoreTotal", value: "99" }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme", assessmentId: "assessment-1" }) },
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "INVALID_INPUT",
        });
        expect(updateCrmInlineFieldMock).not.toHaveBeenCalled();
    });

    test("maps canonical not-found errors to tenant-safe response", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            role: "viewer",
            plan: "growth",
        });
        buildOperatorCrmRecordDetailMock.mockResolvedValue(null);

        const response = await GET(
            new Request("http://localhost/api/org/acme/crm/records/missing") as any,
            { params: Promise.resolve({ slug: "acme", assessmentId: "missing" }) },
        );

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "NOT_FOUND",
        });
    });
});
