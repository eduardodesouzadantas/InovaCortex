import {
    canAccessExecutiveSurface,
    evaluateExecutiveSurfaceAccess,
    getExecutiveLoginErrorMessage,
    resolvePostLoginPath,
} from "../lib/executive/access";
import type { AuthContext } from "../lib/auth/session";

function createAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
    return {
        isAuthenticated: false,
        authScope: null,
        organizationId: null,
        organizationSlug: null,
        userId: null,
        role: null,
        session: null,
        ...overrides,
    };
}

describe("Executive access helpers", () => {
    test("routes executive login to the CEO surface only for admin-capable roles", () => {
        expect(resolvePostLoginPath({
            orgSlug: "acme",
            role: "owner",
            requestedSurface: "executive",
        })).toBe("/org/acme/executive");

        expect(resolvePostLoginPath({
            orgSlug: "acme",
            role: "admin",
            requestedSurface: "executive",
        })).toBe("/org/acme/executive");

        expect(resolvePostLoginPath({
            orgSlug: "acme",
            role: "closer",
            requestedSurface: "executive",
        })).toBe("/org/acme/admin");
    });

    test("keeps executive surface access blocked for non-executive roles", () => {
        expect(canAccessExecutiveSurface("viewer")).toBe(false);

        const result = evaluateExecutiveSurfaceAccess(createAuthContext({
            isAuthenticated: true,
            authScope: "tenant",
            organizationId: "org-a",
            organizationSlug: "acme",
            userId: "user-1",
            role: "closer",
            session: {
                userId: "user-1",
                orgId: "org-a",
                orgSlug: "acme",
                role: "closer",
            },
        }), "acme");

        expect(result).toEqual({
            state: "forbidden",
            reason: "FORBIDDEN",
        });
    });

    test("redirects unauthenticated and wrong-scope sessions predictably", () => {
        expect(evaluateExecutiveSurfaceAccess(createAuthContext(), "acme")).toEqual({
            state: "redirect",
            reason: "UNAUTHENTICATED",
            redirectTo: "/org/acme/executive/login?reason=UNAUTHENTICATED",
        });

        expect(evaluateExecutiveSurfaceAccess(createAuthContext({
            isAuthenticated: true,
            authScope: "agency",
            organizationId: "agency-org",
            organizationSlug: "inovacortex",
            userId: "user-1",
            role: "owner",
            session: {
                userId: "user-1",
                orgId: "agency-org",
                orgSlug: "inovacortex",
                role: "owner",
            },
        }), "acme")).toEqual({
            state: "redirect",
            reason: "WRONG_SCOPE",
            redirectTo: "/agency",
        });
    });

    test("redirects tenant mismatch to the authenticated tenant home", () => {
        expect(evaluateExecutiveSurfaceAccess(createAuthContext({
            isAuthenticated: true,
            authScope: "tenant",
            organizationId: "org-b",
            organizationSlug: "globex",
            userId: "user-1",
            role: "admin",
            session: {
                userId: "user-1",
                orgId: "org-b",
                orgSlug: "globex",
                role: "admin",
            },
        }), "acme")).toEqual({
            state: "redirect",
            reason: "TENANT_MISMATCH",
            redirectTo: "/org/globex/executive",
        });

        expect(getExecutiveLoginErrorMessage("WRONG_SCOPE")).toContain("modo agency");
    });
});
