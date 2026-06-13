const requireOrgContextFromRequestMock = jest.fn();
const orgContextErrorResponseMock = jest.fn((error: Error) => Response.json({
    success: false,
    error: error.message,
}, { status: 403 }));
const buildOperatorCrmWorkspaceMock = jest.fn();
const listCrmSavedViewsMock = jest.fn();
const parseCrmSavedViewInputMock = jest.fn();
const saveCrmSavedViewMock = jest.fn();

jest.mock("../lib/auth/org-context", () => ({
    requireOrgContextFromRequest: requireOrgContextFromRequestMock,
    orgContextErrorResponse: orgContextErrorResponseMock,
}));

jest.mock("../lib/operator/crm-workspace", () => ({
    buildOperatorCrmWorkspace: buildOperatorCrmWorkspaceMock,
    listCrmSavedViews: listCrmSavedViewsMock,
    parseCrmSavedViewInput: parseCrmSavedViewInputMock,
    saveCrmSavedView: saveCrmSavedViewMock,
}));

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { GET, POST } from "../app/api/org/[slug]/crm/views/route";

describe("CRM saved views route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        buildOperatorCrmWorkspaceMock.mockResolvedValue({
            table: {
                columns: [{ id: "company", viewIds: ["all", "follow-up"] }],
            },
            views: {
                system: [{
                    id: "follow-up",
                    kind: "system",
                    baseViewId: "follow-up",
                    label: "Follow-up",
                    description: "Fila",
                    defaultMode: "table",
                    sortId: "priority-desc",
                    columnIds: ["company"],
                }],
            },
        });
    });

    test("lists saved views with tenant-safe org and user context", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            userId: "user-1",
            role: "viewer",
            plan: "growth",
        });
        listCrmSavedViewsMock.mockResolvedValue([
            {
                id: "saved:follow-up-owner",
                kind: "saved",
                baseViewId: "follow-up",
                label: "Minha fila",
                description: "View salva",
                defaultMode: "table",
                sortId: "priority-desc",
                scope: "user",
                columnIds: ["company"],
            },
        ]);

        const response = await GET(
            new Request("http://localhost/api/org/acme/crm/views") as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: [{ id: "saved:follow-up-owner" }],
        });
        expect(listCrmSavedViewsMock).toHaveBeenCalledWith({
            organizationId: "org-a",
            userId: "user-1",
        });
    });

    test("rejects tenant-scoped save for non-admin roles", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            userId: "user-1",
            role: "closer",
            plan: "growth",
        });
        parseCrmSavedViewInputMock.mockReturnValue({
            success: true,
            data: {
                name: "Equipe",
                scope: "tenant",
                baseViewId: "follow-up",
                defaultMode: "table",
                sortId: "priority-desc",
                columnIds: ["company"],
            },
        });

        const response = await POST(
            new Request("http://localhost/api/org/acme/crm/views", {
                method: "POST",
                body: JSON.stringify({ name: "Equipe" }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(403);
        expect(saveCrmSavedViewMock).not.toHaveBeenCalled();
    });

    test("saves a validated user view through the central contract", async () => {
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            userId: "user-1",
            role: "admin",
            plan: "growth",
        });
        parseCrmSavedViewInputMock.mockReturnValue({
            success: true,
            data: {
                name: "Minha fila",
                scope: "user",
                baseViewId: "follow-up",
                defaultMode: "table",
                sortId: "priority-desc",
                columnIds: ["company"],
            },
        });
        saveCrmSavedViewMock.mockResolvedValue({
            view: {
                id: "saved:follow-up-owner",
                label: "Minha fila",
            },
        });

        const response = await POST(
            new Request("http://localhost/api/org/acme/crm/views", {
                method: "POST",
                body: JSON.stringify({ name: "Minha fila" }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: { id: "saved:follow-up-owner" },
        });
        expect(saveCrmSavedViewMock).toHaveBeenCalledWith({
            organizationId: "org-a",
            userId: "user-1",
            role: "admin",
            name: "Minha fila",
            scope: "user",
            baseViewId: "follow-up",
            defaultMode: "table",
            sortId: "priority-desc",
            columnIds: ["company"],
        });
    });
});
