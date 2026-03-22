import { NextRequest, NextResponse } from "next/server";
import { getAuthContextFromRequest, type AuthContext } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { evaluateExecutiveSurfaceAccess } from "@/lib/executive/access";
import { isShelllessPath } from "@/lib/navigation/surface-shell";

function isTruthyFlag(value: string | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isLayerGuardsEnabled(): boolean {
    return isTruthyFlag(process.env.FF_LAYER_GUARDS);
}

function applySecurityHeaders(response: NextResponse, pathname: string): NextResponse {
    if (pathname.startsWith("/diagnostico/")) {
        response.headers.set("X-Robots-Tag", "noindex, nofollow");
        response.headers.set("Cache-Control", "private, no-store");
    }

    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/pdf/")) {
        response.headers.set("X-Content-Type-Options", "nosniff");
        response.headers.set("X-Frame-Options", "DENY");
    }

    return response;
}

function isAgencyPageRoute(pathname: string): boolean {
    return pathname === "/agency"
        || pathname.startsWith("/agency/")
        || pathname === "/admin"
        || pathname.startsWith("/admin/");
}

function isAgencyPublicPage(pathname: string): boolean {
    return pathname === "/agency/login" || pathname === "/admin/login";
}

function extractTenantAdminSlug(pathname: string): string | null {
    const match = pathname.match(/^\/org\/([^/]+)\/admin(?:\/|$)/);
    return match?.[1] ?? null;
}

function extractTenantExecutiveSlug(pathname: string): string | null {
    const match = pathname.match(/^\/org\/([^/]+)\/executive(?:\/|$)/);
    return match?.[1] ?? null;
}

function isTenantAdminLoginPage(pathname: string): boolean {
    return /^\/org\/[^/]+\/admin\/login(?:\/)?$/.test(pathname);
}

function isTenantExecutiveLoginPage(pathname: string): boolean {
    return /^\/org\/[^/]+\/executive\/login(?:\/)?$/.test(pathname);
}

function isLegacyBuilderTenantPage(pathname: string): boolean {
    return /^\/org\/[^/]+\/admin\/builder(?:\/|$)/.test(pathname);
}

function isAgencyApiRoute(pathname: string): boolean {
    return pathname.startsWith("/api/agency/") || pathname.startsWith("/api/admin/");
}

function isSystemApiRoute(pathname: string): boolean {
    return pathname.startsWith("/api/system/");
}

function isPublicWebhookRoute(pathname: string): boolean {
    return pathname.startsWith("/api/webhooks/");
}

function isAgencyPublicApi(pathname: string): boolean {
    return pathname === "/api/agency/auth/login"
        || pathname === "/api/admin/login"
        || pathname === "/api/agency/auth/logout"
        || pathname === "/api/auth/logout";
}

function extractTenantApiSlug(pathname: string): string | null {
    const match = pathname.match(/^\/api\/org\/([^/]+)(?:\/|$)/);
    return match?.[1] ?? null;
}

function isLegacyBuilderTenantApi(pathname: string): boolean {
    return /^\/api\/org\/[^/]+\/builder(?:\/|$)/.test(pathname);
}

function redirectTo(path: string, request: NextRequest): NextResponse {
    return NextResponse.redirect(new URL(path, request.url));
}

function apiError(status: 401 | 403, error: "UNAUTHORIZED" | "FORBIDDEN"): NextResponse {
    return NextResponse.json({ success: false, error }, { status });
}

function redirectToTenantHome(auth: AuthContext, request: NextRequest, fallbackPath: string): NextResponse {
    if (auth.organizationSlug) {
        return redirectTo(`/org/${auth.organizationSlug}/admin`, request);
    }
    return redirectTo(fallbackPath, request);
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const requestHeaders = new Headers(request.headers);
    if (isShelllessPath(pathname)) {
        requestHeaders.set("x-inovacortex-shellless", "1");
    }

    const proceed = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    let cachedAuth: AuthContext | null = null;
    const getAuth = async () => {
        if (cachedAuth) return cachedAuth;
        cachedAuth = await getAuthContextFromRequest(request);
        return cachedAuth;
    };

    if (isAgencyPageRoute(pathname)) {
        if (!isLayerGuardsEnabled()) {
            return applySecurityHeaders(proceed, pathname);
        }

        if (isAgencyPublicPage(pathname)) {
            return applySecurityHeaders(proceed, pathname);
        }

        const auth = await getAuth();
        if (!auth.isAuthenticated) {
            return applySecurityHeaders(redirectTo("/agency/login", request), pathname);
        }
        if (auth.authScope !== "agency") {
            return applySecurityHeaders(redirectToTenantHome(auth, request, "/agency/login"), pathname);
        }

        return applySecurityHeaders(proceed, pathname);
    }

    const tenantAdminSlug = extractTenantAdminSlug(pathname);
    if (tenantAdminSlug) {
        if (!isLayerGuardsEnabled()) {
            return applySecurityHeaders(proceed, pathname);
        }

        if (isTenantAdminLoginPage(pathname)) {
            return applySecurityHeaders(proceed, pathname);
        }

        const auth = await getAuth();
        if (!auth.isAuthenticated) {
            return applySecurityHeaders(redirectTo(`/org/${tenantAdminSlug}/admin/login`, request), pathname);
        }
        if (
            isLegacyBuilderTenantPage(pathname)
            && auth.authScope === "agency"
            && auth.organizationSlug === tenantAdminSlug
        ) {
            return applySecurityHeaders(proceed, pathname);
        }
        if (auth.authScope !== "tenant") {
            return applySecurityHeaders(redirectTo("/agency/login", request), pathname);
        }
        if (!auth.organizationSlug || auth.organizationSlug !== tenantAdminSlug) {
            return applySecurityHeaders(redirectToTenantHome(auth, request, `/org/${tenantAdminSlug}/admin/login`), pathname);
        }

        return applySecurityHeaders(proceed, pathname);
    }

    const tenantExecutiveSlug = extractTenantExecutiveSlug(pathname);
    if (tenantExecutiveSlug) {
        if (!isLayerGuardsEnabled()) {
            return applySecurityHeaders(proceed, pathname);
        }

        if (isTenantExecutiveLoginPage(pathname)) {
            return applySecurityHeaders(proceed, pathname);
        }

        const auth = await getAuth();
        const access = evaluateExecutiveSurfaceAccess(auth, tenantExecutiveSlug);

        if (access.state === "redirect") {
            return applySecurityHeaders(redirectTo(access.redirectTo, request), pathname);
        }

        if (access.state === "forbidden") {
            return applySecurityHeaders(proceed, pathname);
        }

        return applySecurityHeaders(proceed, pathname);
    }

    if (isAgencyApiRoute(pathname)) {
        if (!isLayerGuardsEnabled()) {
            return applySecurityHeaders(proceed, pathname);
        }

        if (isAgencyPublicApi(pathname)) {
            return applySecurityHeaders(proceed, pathname);
        }

        const auth = await getAuth();
        if (!auth.isAuthenticated) {
            return applySecurityHeaders(apiError(401, "UNAUTHORIZED"), pathname);
        }
        if (auth.authScope !== "agency") {
            return applySecurityHeaders(apiError(403, "FORBIDDEN"), pathname);
        }

        return applySecurityHeaders(proceed, pathname);
    }

    if (isPublicWebhookRoute(pathname)) {
        return applySecurityHeaders(proceed, pathname);
    }

    if (isSystemApiRoute(pathname)) {
        return applySecurityHeaders(proceed, pathname);
    }

    const tenantApiSlug = extractTenantApiSlug(pathname);
    if (tenantApiSlug) {
        if (!isLayerGuardsEnabled()) {
            return applySecurityHeaders(proceed, pathname);
        }

        const auth = await getAuth();
        if (!auth.isAuthenticated) {
            return applySecurityHeaders(apiError(401, "UNAUTHORIZED"), pathname);
        }
        if (auth.authScope === "agency" && auth.role && hasRole(auth.role, "viewer")) {
            return applySecurityHeaders(proceed, pathname);
        }
        if (
            isLegacyBuilderTenantApi(pathname)
            && auth.authScope === "agency"
            && auth.organizationSlug === tenantApiSlug
        ) {
            return applySecurityHeaders(proceed, pathname);
        }
        if (auth.authScope !== "tenant") {
            return applySecurityHeaders(apiError(403, "FORBIDDEN"), pathname);
        }
        if (!auth.organizationSlug || auth.organizationSlug !== tenantApiSlug) {
            return applySecurityHeaders(apiError(403, "FORBIDDEN"), pathname);
        }

        return applySecurityHeaders(proceed, pathname);
    }

    if (!isLayerGuardsEnabled()) {
        return applySecurityHeaders(proceed, pathname);
    }

    return applySecurityHeaders(proceed, pathname);
}

export const config = {
    matcher: [
        "/diagnostico/:path*",
        "/api/:path*",
        "/agency/:path*",
        "/agency",
        "/admin/:path*",
        "/admin",
        "/org/:path*",
    ],
};
