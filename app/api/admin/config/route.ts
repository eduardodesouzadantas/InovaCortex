import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
} from "@/lib/auth/admin-api-guard";
import { getAgencyOrgSlug, getAuthContextFromRequest } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { listMaskedMetaSettings, sanitizeMetaSettingInputs, upsertMetaSettings } from "@/lib/whatsapp/meta-settings";

export const runtime = "nodejs";

type LegacyConfigResolution = {
    organizationId: string;
    successorPath: string;
    actorUserId: string;
    actorScope: "agency" | "tenant";
};

function withDeprecation(response: NextResponse, successorPath: string): NextResponse {
    return applyLegacyAdminApiDeprecationHeaders(response, { successorPath });
}

async function resolveOrganizationBySlug(slug: string): Promise<{ id: string; slug: string } | null> {
    if (!slug) return null;
    return prisma.organization.findUnique({
        where: { slug },
        select: { id: true, slug: true },
    });
}

async function resolveLegacyConfigTarget(request: NextRequest): Promise<
    { ok: true; value: LegacyConfigResolution }
    | { ok: false; response: NextResponse }
> {
    const auth = await getAuthContextFromRequest(request);
    if (!auth.isAuthenticated || !auth.userId || !auth.organizationId || !auth.organizationSlug || !auth.role) {
        return {
            ok: false,
            response: withDeprecation(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), "/api/agency/settings/meta"),
        };
    }

    const requestedOrgSlug = new URL(request.url).searchParams.get("org")?.trim() ?? "";
    const agencyOrgSlug = getAgencyOrgSlug();
    const isAgencySession = auth.organizationSlug.toLowerCase() === agencyOrgSlug.toLowerCase();

    if (isAgencySession) {
        if (!hasRole(auth.role, "admin")) {
            return {
                ok: false,
                response: withDeprecation(NextResponse.json({ error: "Forbidden" }, { status: 403 }), "/api/agency/settings/meta"),
            };
        }

        if (!requestedOrgSlug) {
            return {
                ok: true,
                value: {
                    organizationId: auth.organizationId,
                    successorPath: "/api/agency/settings/meta",
                    actorUserId: auth.userId,
                    actorScope: "agency",
                },
            };
        }

        const targetOrg = await resolveOrganizationBySlug(requestedOrgSlug);
        if (!targetOrg) {
            return {
                ok: false,
                response: withDeprecation(NextResponse.json({ error: "Organization not found" }, { status: 400 }), "/api/agency/settings/meta"),
            };
        }

        return {
            ok: true,
            value: {
                organizationId: targetOrg.id,
                successorPath: `/api/org/${targetOrg.slug}/whatsapp/config/meta`,
                actorUserId: auth.userId,
                actorScope: "agency",
            },
        };
    }

    if (auth.authScope !== "tenant") {
        return {
            ok: false,
            response: withDeprecation(NextResponse.json({ error: "Forbidden" }, { status: 403 }), "/api/agency/settings/meta"),
        };
    }

    if (!hasRole(auth.role, "admin")) {
        return {
            ok: false,
            response: withDeprecation(
                NextResponse.json({ error: "Forbidden" }, { status: 403 }),
                `/api/org/${auth.organizationSlug}/whatsapp/config/meta`,
            ),
        };
    }

    if (requestedOrgSlug && requestedOrgSlug !== auth.organizationSlug) {
        return {
            ok: false,
            response: withDeprecation(
                NextResponse.json({ error: "Forbidden" }, { status: 403 }),
                `/api/org/${auth.organizationSlug}/whatsapp/config/meta`,
            ),
        };
    }

    return {
        ok: true,
        value: {
            organizationId: auth.organizationId,
            successorPath: `/api/org/${auth.organizationSlug}/whatsapp/config/meta`,
            actorUserId: auth.userId,
            actorScope: "tenant",
        },
    };
}

async function GETHandler(request: NextRequest) {
    const resolution = await resolveLegacyConfigTarget(request);
    if (!resolution.ok) return resolution.response;

    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: resolution.value.successorPath,
    });
    if (redirectResponse) return redirectResponse;

    const settings = await listMaskedMetaSettings(resolution.value.organizationId);
    return withDeprecation(
        NextResponse.json({ settings }, { status: 200 }),
        resolution.value.successorPath,
    );
}

async function POSTHandler(request: NextRequest) {
    const resolution = await resolveLegacyConfigTarget(request);
    if (!resolution.ok) return resolution.response;

    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: resolution.value.successorPath,
    });
    if (redirectResponse) return redirectResponse;

    const frozen = createLegacyAdminWriteFrozenResponse({ successorPath: resolution.value.successorPath });
    if (frozen) return frozen;

    const body = await request.json().catch(() => null);
    const parsed = sanitizeMetaSettingInputs(body);
    if (!parsed.ok) {
        return withDeprecation(
            NextResponse.json({ error: parsed.error }, { status: 400 }),
            resolution.value.successorPath,
        );
    }

    const result = await upsertMetaSettings(resolution.value.organizationId, parsed.settings);

    await writeAuditEvent({
        organizationId: resolution.value.organizationId,
        action: "legacyAdminConfigUpdated",
        details: {
            keys: result.updatedKeys,
            actorUserId: resolution.value.actorUserId,
            actorScope: resolution.value.actorScope,
            via: "/api/admin/config",
        },
        strict: false,
        context: {
            keys: result.updatedKeys.length,
            actorScope: resolution.value.actorScope,
        },
    });

    return withDeprecation(
        NextResponse.json({ success: true, updatedKeys: result.updatedKeys }, { status: 200 }),
        resolution.value.successorPath,
    );
}

export const GET = withApiLogging("/api/admin/config", "GET", GETHandler);
export const POST = withApiLogging("/api/admin/config", "POST", POSTHandler);
