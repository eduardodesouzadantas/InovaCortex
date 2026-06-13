import { getAgencyOrgSlug } from "@/lib/auth/session";
import { tenantErrorResponse } from "@/lib/auth/tenant-route";

function isTruthyFlag(value: string | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isAgencyBuilderEnabled(): boolean {
    const raw = process.env.FF_AGENCY_BUILDER;
    if (typeof raw === "undefined") return true;
    return isTruthyFlag(raw);
}

export function isAgencyBuilderSlug(slug: string): boolean {
    return slug.trim().toLowerCase() === getAgencyOrgSlug();
}

export function applyLegacyBuilderDeprecationHeaders(response: Response): Response {
    response.headers.set("Deprecation", "true");
    response.headers.set("Sunset", "Wed, 30 Sep 2026 23:59:59 GMT");
    response.headers.set("Link", "</api/agency/builder>; rel=\"successor-version\"");
    response.headers.set("X-Inova-Legacy-Adapter", "builder-tenant-route");
    return response;
}

export function ensureLegacyBuilderSlug(slug: string): Response | null {
    if (isAgencyBuilderSlug(slug)) return null;
    return applyLegacyBuilderDeprecationHeaders(
        tenantErrorResponse("FORBIDDEN", { message: "Builder moved to agency scope" }),
    );
}
