import { NextRequest } from "next/server";

import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { consumeInviteRateLimit } from "@/lib/auth/auth-rate-limit";
import { createOrganizationInvite } from "@/lib/auth/invite-service";
import { apiError, apiSuccess } from "@/lib/http/api-response";
import { logger, withApiLogging } from "@/lib/logger";

export const runtime = "nodejs";

async function readRequestBody(request: NextRequest): Promise<{ organizationId?: string; email?: string; role?: string } | null> {
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
        email: typeof formData.get("email") === "string" ? String(formData.get("email")) : undefined,
        role: typeof formData.get("role") === "string" ? String(formData.get("role")) : undefined,
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
    const email = body?.email?.trim() ?? "";
    const role = body?.role?.trim() ?? undefined;

    if (!organizationId || !email) {
        return apiError(request, {
            message: "ORGANIZATION_ID_AND_EMAIL_REQUIRED",
            code: "BAD_REQUEST",
        }, { status: 400 });
    }

    const rateLimit = await consumeInviteRateLimit({
        organizationId,
        email,
        request,
    });

    if (!rateLimit.allowed) {
        logger.warn("Agency invite create rate limit exceeded", {
            operation: "agencyInvite.rateLimit",
            organizationId,
            bucket: rateLimit.exceededBucket,
            identifierHash: rateLimit.identifierHash,
            retryAfterSeconds: rateLimit.retryAfterSeconds,
        });

        return apiError(request, {
            message: "TOO_MANY_ATTEMPTS",
            code: "TOO_MANY_REQUESTS",
        }, {
            status: 429,
            headers: {
                "Retry-After": String(rateLimit.retryAfterSeconds),
            },
        });
    }

    const result = await createOrganizationInvite({
        organizationId,
        email,
        role,
        actorUserId: access.auth?.userId ?? "unknown",
        actorRole: access.auth?.role ?? "admin",
        source: "agency_surface",
        exposeToken: process.env.NODE_ENV !== "production",
        baseUrl: request.url,
    });

    if (!result.ok) {
        const status = result.reason === "not_found" ? 404 : result.reason === "user_limit_reached" ? 409 : 400;
        return apiError(request, {
            message:
                result.reason === "not_found"
                    ? "ORGANIZATION_NOT_FOUND"
                    : result.reason === "email_conflict"
                        ? "EMAIL_CONFLICT"
                        : result.reason === "user_limit_reached"
                            ? "USER_LIMIT_REACHED"
                            : "INVALID_ROLE",
            code:
                result.reason === "not_found"
                    ? "NOT_FOUND"
                    : result.reason === "email_conflict"
                        ? "CONFLICT"
                        : result.reason === "user_limit_reached"
                            ? "CONFLICT"
                            : "BAD_REQUEST",
        }, { status });
    }

    logger.info("Agency invite created", {
        operation: "agencyInvite.create",
        organizationId: result.data.organizationId,
        inviteId: result.data.invite.id,
        email: result.data.invite.email,
        actorUserId: access.auth?.userId ?? "unknown",
        actorRole: access.auth?.role ?? "admin",
    });

    return apiSuccess(request, {
        organizationId: result.data.organizationId,
        organizationName: result.data.organizationName,
        invite: result.data.invite,
        inviteUrl: result.data.inviteUrl,
    });
}

export const POST = withApiLogging("/api/agency/invites/create", "POST", POSTHandler);
