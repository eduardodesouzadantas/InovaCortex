/**
 * lib/builder/builder-guard.ts
 * V25: Internal Builder Autopilot - gating + RBAC utilities.
 *
 * Gating rules (AND):
 *   1. org.slug === "inovacortex" OR AppSetting internal_builder_enabled = "true"
 *   2. Caller must be owner/admin
 *   3. For route handlers, session must belong to agency scope/org
 *
 * Legacy x-admin-token auth is disabled by default and only available when
 * FF_ENABLE_LEGACY_HEADER_ADMIN_AUTH=true for emergency compatibility.
 */

import type { NextRequest } from "next/server";
import {
    decodeSessionToken,
    getAgencyOrgSlug,
    getAuthContextFromRequest,
    isAuthContextSplitEnabled,
} from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";

export const INTERNAL_ORG_SLUG = "inovacortex";
export const SETTING_KEY = "internal_builder_enabled";

type GuardFailureStatus = 401 | 403 | 404;

export type BuilderAccessResult =
    | { allowed: true; orgId: string }
    | { allowed: false; reason: string; status: GuardFailureStatus };

const BUILDER_ACCESS_CACHE_TTL_MS = 60_000;

let builderAccessCache: {
    expiresAt: number;
    orgId: string;
    agencyOrgSlug: string;
    builderEnabled: boolean;
} | null = null;

function isTruthyFlag(value: string | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isLegacyHeaderAdminAuthEnabled(): boolean {
    return isTruthyFlag(process.env.FF_ENABLE_LEGACY_HEADER_ADMIN_AUTH);
}

export function isAdminToken(tokenHeader: string | null): boolean {
    const expected = process.env.ADMIN_SECRET_TOKEN;
    return !!expected && !!tokenHeader && tokenHeader === expected;
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
    const map: Record<string, string> = {};
    if (!cookieHeader) return map;
    for (const chunk of cookieHeader.split(";")) {
        const [rawKey, ...rawValue] = chunk.trim().split("=");
        if (!rawKey) continue;
        map[rawKey] = decodeURIComponent(rawValue.join("=") ?? "");
    }
    return map;
}

async function resolveSessionFromRequestLike(req: Request): Promise<{
    isAuthenticated: boolean;
    role: string | null;
    organizationSlug: string | null;
    authScope: "agency" | "tenant" | null;
}> {
    if ("cookies" in req) {
        const auth = await getAuthContextFromRequest(req as NextRequest);
        return {
            isAuthenticated: auth.isAuthenticated,
            role: auth.role,
            organizationSlug: auth.organizationSlug,
            authScope: auth.authScope,
        };
    }

    const cookies = parseCookieHeader(req.headers.get("cookie"));
    const token = cookies.session;
    if (!token) {
        return { isAuthenticated: false, role: null, organizationSlug: null, authScope: null };
    }

    const session = await decodeSessionToken(token);
    if (!session) {
        return { isAuthenticated: false, role: null, organizationSlug: null, authScope: null };
    }

    return {
        isAuthenticated: true,
        role: session.role,
        organizationSlug: session.orgSlug,
        authScope: isAuthContextSplitEnabled() && session.orgSlug.toLowerCase() === getAgencyOrgSlug() ? "agency" : "tenant",
    };
}

async function authorizeBuilderCaller(
    orgSlug: string,
    authInput: Request | string | undefined,
): Promise<{ ok: true } | { ok: false; reason: string; status: GuardFailureStatus }> {
    // Internal non-request callers (worker/orchestrator) can pass role directly.
    if (typeof authInput === "string" || authInput == null) {
        const role = authInput ?? "";
        if (!hasRole(role, "admin")) {
            return { ok: false, reason: "RBAC: owner or admin required", status: 403 };
        }
        return { ok: true };
    }

    const requestAuth = await resolveSessionFromRequestLike(authInput);
    if (requestAuth.isAuthenticated) {
        if (isAuthContextSplitEnabled() && requestAuth.authScope !== "agency") {
            return { ok: false, reason: "Forbidden auth scope", status: 403 };
        }

        const agencyOrgSlug = getAgencyOrgSlug();
        if (!requestAuth.organizationSlug || requestAuth.organizationSlug.toLowerCase() !== agencyOrgSlug) {
            return { ok: false, reason: "Forbidden auth scope", status: 403 };
        }

        if (orgSlug.toLowerCase() !== agencyOrgSlug) {
            return { ok: false, reason: "Organization mismatch", status: 403 };
        }

        if (!requestAuth.role || !hasRole(requestAuth.role, "admin")) {
            return { ok: false, reason: "RBAC: owner or admin required", status: 403 };
        }

        return { ok: true };
    }

    // Emergency-only compatibility path.
    if (isLegacyHeaderAdminAuthEnabled() && isAdminToken(authInput.headers.get("x-admin-token"))) {
        const roleHint = authInput.headers.get("x-builder-role") ?? "admin";
        if (!hasRole(roleHint, "admin")) {
            return { ok: false, reason: "RBAC: owner or admin required", status: 403 };
        }
        return { ok: true };
    }

    return { ok: false, reason: "Unauthorized", status: 401 };
}

/**
 * Checks whether the requesting user/org is allowed to use the Builder.
 * For route handlers, pass the request object for strict session validation:
 *   checkBuilderAccess(slug, req)
 *
 * Internal callers may still pass role string:
 *   checkBuilderAccess(slug, role)
 */
export async function checkBuilderAccess(
    orgSlug: string,
    authInput?: Request | string,
): Promise<BuilderAccessResult> {
    const auth = await authorizeBuilderCaller(orgSlug, authInput);
    if (!auth.ok) {
        return { allowed: false, reason: auth.reason, status: auth.status };
    }

    const { prisma } = await import("@/lib/prisma");
    const normalizedOrgSlug = orgSlug.trim().toLowerCase();
    const cached = builderAccessCache;

    if (
        cached
        && cached.expiresAt > Date.now()
        && cached.agencyOrgSlug === normalizedOrgSlug
        && cached.builderEnabled
    ) {
        return { allowed: true, orgId: cached.orgId };
    }

    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true, slug: true },
    }).catch(() => null);

    if (!org) {
        return { allowed: false, reason: "Org not found", status: 404 };
    }

    if (org.slug === INTERNAL_ORG_SLUG) {
        builderAccessCache = {
            expiresAt: Date.now() + BUILDER_ACCESS_CACHE_TTL_MS,
            orgId: org.id,
            agencyOrgSlug: normalizedOrgSlug,
            builderEnabled: true,
        };
        return { allowed: true, orgId: org.id };
    }

    const setting = await prisma.appSetting.findUnique({
        where: { key: SETTING_KEY },
    }).catch(() => null);

    if (setting?.value === "true") {
        builderAccessCache = {
            expiresAt: Date.now() + BUILDER_ACCESS_CACHE_TTL_MS,
            orgId: org.id,
            agencyOrgSlug: normalizedOrgSlug,
            builderEnabled: true,
        };
        return { allowed: true, orgId: org.id };
    }

    return { allowed: false, reason: "Builder not enabled for this org", status: 403 };
}

// Status machine
const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ["review", "failed"],
    review: ["approved", "draft", "failed"],
    approved: ["executing", "draft", "failed"],
    executing: ["done", "failed"],
    done: [],
    failed: ["draft"],
};

export function isValidTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export const ALL_BUILD_MODES = ["plan_only", "prompt_pack", "code_patch"] as const;
export const ALL_ARTIFACT_TYPES = ["implementation_plan", "prompt_pack", "diff_plan", "checklist"] as const;

export type BuildMode = typeof ALL_BUILD_MODES[number];
export type ArtifactType = typeof ALL_ARTIFACT_TYPES[number];
