import { NextRequest } from "next/server";

import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { revokeOrganizationInvite } from "@/lib/auth/invite-service";
import { apiError, apiSuccess } from "@/lib/http/api-response";
import { logger, withApiLogging } from "@/lib/logger";

export const runtime = "nodejs";

async function readRequestBody(request: NextRequest): Promise<{ organizationId?: string; inviteId?: string } | null> {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
        return request.json().catch(() => null);
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
        return null;
    }

    return {
        organizationId: typeof formData.get("organizationId") === "string" ? String(formData.get("organizationId")) : undefined,
        inviteId: typeof formData.get("inviteId") === "string" ? String(formData.get("inviteId")) : undefined,
    };
}

async function POSTHandler(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) {
        return apiError(request, {
            message: access.error === "Forbidden" ? "FORBIDDEN" : "UNAUTHORIZED",
            code: access.error === "Forbidden" ? "FORBIDDEN" : "UNAUTHORIZED",
        }, { status: access.status });
    }

    const body = await readRequestBody(request);
    const organizationId = body?.organizationId?.trim() ?? "";
    const inviteId = body?.inviteId?.trim() ?? "";

    if (!organizationId || !inviteId) {
        return apiError(request, {
            message: "ORGANIZATION_ID_AND_INVITE_ID_REQUIRED",
            code: "BAD_REQUEST",
        }, { status: 400 });
    }

    const result = await revokeOrganizationInvite({
        organizationId,
        inviteId,
        actorUserId: access.auth?.userId ?? "unknown",
        actorRole: access.auth?.role ?? "admin",
        source: "agency_surface",
    });

    if (!result.ok) {
        const status = result.reason === "not_found" ? 404 : 409;
        return apiError(request, {
            message: result.reason === "not_found" ? "INVITE_NOT_FOUND" : "INVALID_INVITE_STATE",
            code: result.reason === "not_found" ? "NOT_FOUND" : "CONFLICT",
        }, { status });
    }

    logger.info("Agency invite revoked", {
        operation: "agencyInvite.revoke",
        organizationId: result.organizationId,
        inviteId: result.invite.id,
        actorUserId: access.auth?.userId ?? "unknown",
        actorRole: access.auth?.role ?? "admin",
    });

    return apiSuccess(request, {
        organizationId: result.organizationId,
        organizationName: result.organizationName,
        invite: result.invite,
        changed: result.changed,
    });
}

export const POST = withApiLogging("/api/agency/invites/revoke", "POST", POSTHandler);
