const requireAdminApiAccessMock = jest.fn();
const writeAuditEventMock = jest.fn();
const loadAgencyPlaybookExecutionsMock = jest.fn();
const storeAgencyPlaybookExecutionsMock = jest.fn();

jest.mock("../lib/auth/admin-api-guard", () => ({
    requireAdminApiAccess: requireAdminApiAccessMock,
}));

jest.mock("../lib/audit", () => ({
    writeAuditEvent: writeAuditEventMock,
}));

jest.mock("../lib/agency/surface-overview", () => ({
    loadAgencyPlaybookExecutions: loadAgencyPlaybookExecutionsMock,
    storeAgencyPlaybookExecutions: storeAgencyPlaybookExecutionsMock,
}));

import { GET, POST } from "../app/api/agency/playbooks/status/route";

describe("Agency playbooks status route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        requireAdminApiAccessMock.mockResolvedValue({ ok: true, auth: { organizationId: "org-test", userId: "user-test" }, mode: "session" });
        loadAgencyPlaybookExecutionsMock.mockResolvedValue({});
        storeAgencyPlaybookExecutionsMock.mockResolvedValue(undefined);
        writeAuditEventMock.mockResolvedValue(undefined);
    });

    test("records audit event when marking playbook in-progress", async () => {
        const response = await GET(new Request("http://localhost/api/agency/playbooks/status?playbookId=pb1&action=in-progress&owner=alice&observedImpact=impactok") as unknown as import("next/server").NextRequest);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                status: "in-progress",
                owner: "alice",
                observedImpact: "impactok",
            },
        });

        expect(writeAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-test",
            action: "agencyPlaybook:statusChanged",
            details: expect.objectContaining({
                playbookId: "pb1",
                previousStatus: "suggested",
                nextStatus: "in-progress",
                owner: "alice",
                observedImpact: "impactok",
                actorUserId: "user-test",
            }),
            strict: false,
        }));
    });

    test("records audit event when marking playbook blocked as fallback owner and no observedImpact", async () => {
        const response = await GET(new Request("http://localhost/api/agency/playbooks/status?playbookId=pb2&action=blocked") as unknown as import("next/server").NextRequest);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                status: "blocked",
                owner: "user-test",
                observedImpact: null,
            },
        });

        expect(writeAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-test",
            action: "agencyPlaybook:statusChanged",
            details: expect.objectContaining({
                playbookId: "pb2",
                previousStatus: "suggested",
                nextStatus: "blocked",
                owner: "user-test",
                observedImpact: null,
                actorUserId: "user-test",
            }),
            strict: false,
        }));
    });

    test("records audit event when marking playbook completed and keeps previous status", async () => {
        loadAgencyPlaybookExecutionsMock.mockResolvedValue({
            pb3: {
                status: "in-progress",
                owner: "jose",
                createdAt: "2026-03-17T00:00:00.000Z",
                startedAt: "2026-03-17T01:00:00.000Z",
                completedAt: undefined,
                observedImpact: undefined,
            },
        });

        const response = await GET(new Request("http://localhost/api/agency/playbooks/status?playbookId=pb3&action=complete&observedImpact=done") as unknown as import("next/server").NextRequest);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                status: "completed",
                owner: "user-test",
                observedImpact: "done",
            },
        });

        expect(writeAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-test",
            action: "agencyPlaybook:statusChanged",
            details: expect.objectContaining({
                playbookId: "pb3",
                previousStatus: "in-progress",
                nextStatus: "completed",
                owner: "user-test",
                observedImpact: "done",
                actorUserId: "user-test",
            }),
            strict: false,
        }));
    });

    test("POST endpoint supports JSON payload for status update", async () => {
        const request = new Request("http://localhost/api/agency/playbooks/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playbookId: "pb4", action: "completed", owner: "bob", observedImpact: "excellent" }),
        }) as unknown as import("next/server").NextRequest;

        const response = await POST(request);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                status: "completed",
                owner: "bob",
                observedImpact: "excellent",
            },
        });

        expect(writeAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-test",
            action: "agencyPlaybook:statusChanged",
            details: expect.objectContaining({
                playbookId: "pb4",
                previousStatus: "suggested",
                nextStatus: "completed",
                owner: "bob",
                observedImpact: "excellent",
                actorUserId: "user-test",
            }),
            strict: false,
        }));
    });

    test("POST endpoint rejects invalid JSON payload", async () => {
        const request = new Request("http://localhost/api/agency/playbooks/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // invalid JSON
            body: "{invalid-json}",
        }) as unknown as import("next/server").NextRequest;

        const response = await POST(request);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "INVALID_JSON",
        });

        expect(writeAuditEventMock).not.toHaveBeenCalled();
    });
});