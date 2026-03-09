import { NextRequest, NextResponse } from "next/server";
import { getAuthContextFromRequest, type AuthContext } from "@/lib/auth/session";

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

function isTenantAdminLoginPage(pathname: string): boolean {
    return /^\/org\/[^/]+\/admin\/login(?:\/)?$/.test(pathname);
}

function isLegacyBuilderTenantPage(pathname: string): boolean {
    return /^\/org\/[^/]+\/admin\/builder(?:\/|$)/.test(pathname);
}

function isAgencyApiRoute(pathname: string): boolean {
    return pathname.startsWith("/api/agency/") || pathname.startsWith("/api/admin/");
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

function apiError(status: 401 | 403, error: "UNAUTHENTICATED" | "FORBIDDEN"): NextResponse {
    return NextResponse.json({ error }, { status });
}

function redirectToTenantHome(auth: AuthContext, request: NextRequest, fallbackPath: string): NextResponse {
    if (auth.organizationSlug) {
        return redirectTo(`/org/${auth.organizationSlug}/admin`, request);
    }
    return redirectTo(fallbackPath, request);
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const proceed = NextResponse.next();

    if (!isLayerGuardsEnabled()) {
        return applySecurityHeaders(proceed, pathname);
    }

    let cachedAuth: AuthContext | null = null;
    const getAuth = async () => {
        if (cachedAuth) return cachedAuth;
        cachedAuth = await getAuthContextFromRequest(request);
        return cachedAuth;
    };

    if (isAgencyPageRoute(pathname)) {
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

    if (isAgencyApiRoute(pathname)) {
        if (isAgencyPublicApi(pathname)) {
            return applySecurityHeaders(proceed, pathname);
        }

        const auth = await getAuth();
        if (!auth.isAuthenticated) {
            return applySecurityHeaders(apiError(401, "UNAUTHENTICATED"), pathname);
        }
        if (auth.authScope !== "agency") {
            return applySecurityHeaders(apiError(403, "FORBIDDEN"), pathname);
        }

        return applySecurityHeaders(proceed, pathname);
    }

    const tenantApiSlug = extractTenantApiSlug(pathname);
    if (tenantApiSlug) {
        const auth = await getAuth();
        if (!auth.isAuthenticated) {
            return applySecurityHeaders(apiError(401, "UNAUTHENTICATED"), pathname);
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
