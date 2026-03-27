import {
    assertTenantOwnership,
    resolveTenantRouteError,
    tenantContextErrorResponse,
    tenantNotFoundResponse,
} from "../lib/auth/tenant-route";

describe("Tenant route helpers", () => {
    test("maps unauthenticated errors to a consistent unauthorized response", async () => {
        const response = tenantContextErrorResponse(new Error("UNAUTHENTICATED"));

        expect(response?.status).toBe(401);
        await expect(response?.json()).resolves.toMatchObject({
            success: false,
            error: "Authentication required",
            code: "UNAUTHORIZED",
        });
    });

    test("keeps not found distinct from forbidden", async () => {
        const notFound = tenantNotFoundResponse("Campaign not found");
        const forbidden = resolveTenantRouteError(new Error("FORBIDDEN: requires role 'admin'"));

        expect(notFound.status).toBe(404);
        await expect(notFound.json()).resolves.toMatchObject({
            success: false,
            error: "Campaign not found",
            code: "NOT_FOUND",
        });

        expect(forbidden.status).toBe(403);
        await expect(forbidden.json()).resolves.toMatchObject({
            success: false,
            error: "Access denied",
            code: "FORBIDDEN",
        });
    });

    test("maps ownership mismatch to a tenant mismatch response", async () => {
        expect(() => assertTenantOwnership("org-b", "org-a")).toThrow("TENANT_MISMATCH");

        const response = tenantContextErrorResponse(new Error("TENANT_MISMATCH"));
        expect(response?.status).toBe(403);
        await expect(response?.json()).resolves.toMatchObject({
            success: false,
            error: "Tenant context mismatch",
            code: "TENANT_MISMATCH",
        });
    });
});
