import { NextResponse, type NextRequest } from "next/server";
import { getAgencyOrgSlug, getAuthContextFromRequest, isAuthContextSplitEnabled, type AuthContext } from "@/lib/auth/session";
import { hasRole, type Role } from "@/lib/auth/rbac";

export type AdminApiAuthMode = "session" | "legacy_admin_token";

export type AdminApiGuardSuccess = {
    ok: true;
    mode: AdminApiAuthMode;
    auth: AuthContext | null;
};

export type AdminApiGuardFailure = {
    ok: false;
    status: 401 | 403;
    error: "Unauthorized" | "Forbidden";
};

export type AdminApiGuardResult = AdminApiGuardSuccess | AdminApiGuardFailure;

type LegacyWriteFreezeOptions = {
    successorPath: string;
    mode?: AdminApiAuthMode;
};

type LegacyFinalRedirectOptions = {
    successorPath: string;
    mode?: AdminApiAuthMode;
};

function isTruthyFlag(value: string | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/**
 * Stage-1 decommission behavior:
 * - default: disabled (legacy token blocked)
 * - set FF_DISABLE_ADMIN_TOKEN=false to re-enable emergency fallback
 */
export function isAdminTokenDisabled(): boolean {
    const raw = process.env.FF_DISABLE_ADMIN_TOKEN;
    if (typeof raw === "undefined") return true;
    return isTruthyFlag(raw);
}

/**
 * Stage-2 admin legacy freeze behavior:
 * - default: enabled (legacy /api/admin writes blocked for migrated domains)
 * - set FF_LEGACY_ADMIN_READONLY=false for temporary emergency rollback
 */
export function isLegacyAdminReadonlyEnabled(): boolean {
    const raw = process.env.FF_LEGACY_ADMIN_READONLY;
    if (typeof raw === "undefined") return true;
    return isTruthyFlag(raw);
}

/**
 * Final cutover behavior for legacy /admin and /api/admin namespaces.
 * - default: enabled (legacy API responds with final redirect to canonical agency route)
 * - set FF_LEGACY_ADMIN_FINAL_REDIRECT=false for rollback
 */
export function isLegacyAdminFinalRedirectEnabled(): boolean {
    const raw = process.env.FF_LEGACY_ADMIN_FINAL_REDIRECT;
    if (typeof raw === "undefined") return true;
    return isTruthyFlag(raw);
}

function isLegacyAdminTokenCookie(req: NextRequest): boolean {
    return req.cookies.get("admin_token")?.value === "authenticated_true";
}

function isAgencyContext(auth: AuthContext): boolean {
    if (!auth.isAuthenticated) return false;

    if (isAuthContextSplitEnabled()) {
        return auth.authScope === "agency";
    }

    const agencyOrgSlug = getAgencyOrgSlug();
    return auth.organizationSlug?.toLowerCase() === agencyOrgSlug;
}

export async function requireAdminApiAccess(
    req: NextRequest,
    options?: {
        requiredRole?: Role;
        allowLegacyTokenFallback?: boolean;
    },
): Promise<AdminApiGuardResult> {
    const requiredRole = options?.requiredRole ?? "admin";
    const allowLegacyTokenFallback = options?.allowLegacyTokenFallback ?? false;

    const auth = await getAuthContextFromRequest(req);
    if (auth.isAuthenticated) {
        if (!isAgencyContext(auth)) {
            return { ok: false, status: 403, error: "Forbidden" };
        }

        if (!auth.role || !hasRole(auth.role, requiredRole)) {
            return { ok: false, status: 403, error: "Forbidden" };
        }

        return { ok: true, mode: "session", auth };
    }

    if (allowLegacyTokenFallback && !isAdminTokenDisabled() && isLegacyAdminTokenCookie(req)) {
        return { ok: true, mode: "legacy_admin_token", auth: null };
    }

    return { ok: false, status: 401, error: "Unauthorized" };
}

export function applyAdminTokenDeprecationHeaders<T extends NextResponse>(
    response: T,
    mode: AdminApiAuthMode,
): T {
    if (mode !== "legacy_admin_token") return response;

    response.headers.set("Deprecation", "true");
    response.headers.set("Sunset", "Wed, 30 Sep 2026 23:59:59 GMT");
    response.headers.set("X-Inova-Legacy-Auth", "admin_token");
    response.headers.set("X-Inova-Legacy-Auth-Deprecated", "true");
    return response;
}

const LEGACY_ADMIN_API_SUNSET = "Wed, 30 Sep 2026 23:59:59 GMT";

export function applyLegacyAdminApiDeprecationHeaders<T extends NextResponse>(
    response: T,
    options?: {
        successorPath?: string;
        mode?: AdminApiAuthMode;
    },
): T {
    response.headers.set("Deprecation", "true");
    response.headers.set("Sunset", LEGACY_ADMIN_API_SUNSET);
    response.headers.set("X-Inova-Legacy-Api", "/api/admin");
    if (options?.successorPath) {
        response.headers.set("X-Inova-Successor-Path", options.successorPath);
    }
    if (options?.mode) {
        applyAdminTokenDeprecationHeaders(response, options.mode);
    }
    return response;
}

export function createLegacyAdminWriteFrozenResponse(options: LegacyWriteFreezeOptions): NextResponse | null {
    if (!isLegacyAdminReadonlyEnabled()) return null;

    const response = NextResponse.json(
        {
            error: "Legacy /api/admin write operations are frozen",
            code: "LEGACY_ADMIN_WRITE_FROZEN",
            successorPath: options.successorPath,
        },
        { status: 409 },
    );

    applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: options.successorPath,
        mode: options.mode,
    });
    response.headers.set("Warning", `299 - "Legacy admin write frozen. Use ${options.successorPath}"`);
    response.headers.set("X-Inova-Legacy-Write-Frozen", "true");
    response.headers.set("X-Inova-Legacy-Mode", "read-only");
    return response;
}

export function createLegacyAdminFinalRedirectResponse(
    request: NextRequest,
    options: LegacyFinalRedirectOptions,
): NextResponse | null {
    if (!isLegacyAdminFinalRedirectEnabled()) return null;

    const url = new URL(options.successorPath, request.url);
    url.search = new URL(request.url).search;
    const response = NextResponse.redirect(url, 308);
    applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: options.successorPath,
        mode: options.mode,
    });
    response.headers.set("Link", `<${options.successorPath}>; rel="successor-version"`);
    response.headers.set("Warning", `299 - "Legacy endpoint final cutover. Use ${options.successorPath}"`);
    response.headers.set("X-Inova-Legacy-Cutover", "final-redirect");
    return response;
}
