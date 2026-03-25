import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { consumePasswordResetRateLimit } from "@/lib/auth/auth-rate-limit";
import { requestOrganizationUserPasswordReset } from "@/lib/auth/password-reset-service";
import { apiError, apiSuccess } from "@/lib/http/api-response";
import { logger, withApiLogging } from "@/lib/logger";

export const runtime = "nodejs";

function buildResetConfirmUrl(request: NextRequest, token: string): string {
    const url = new URL("/api/auth/reset/confirm", request.url);
    url.searchParams.set("token", token);
    return url.toString();
}

async function readRequestBody(request: NextRequest): Promise<{ organizationId?: string; userId?: string } | null> {
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
        userId: typeof formData.get("userId") === "string" ? String(formData.get("userId")) : undefined,
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
    const userId = body?.userId?.trim() ?? "";

    if (!organizationId || !userId) {
        return apiError(request, {
            message: "ORGANIZATION_ID_AND_USER_ID_REQUIRED",
            code: "BAD_REQUEST",
        }, { status: 400 });
    }

    const rateLimit = await consumePasswordResetRateLimit({
        organizationId,
        userId,
        request,
    });

    if (!rateLimit.allowed) {
        logger.warn("Password reset request rate limit exceeded", {
            operation: "authReset.rateLimit",
            organizationId,
            userId,
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

    const result = await requestOrganizationUserPasswordReset({
        organizationId,
        userId,
        actorUserId: access.auth?.userId ?? "unknown",
        actorRole: access.auth?.role ?? "admin",
        source: "agency_surface",
        baseUrl: request.url,
    });

    if (!result.ok) {
        logger.warn("Agency password reset request rejected", {
            operation: "authReset.request",
            organizationId,
            userId,
            reason: result.reason,
        });
        return apiError(request, {
            message: "USER_NOT_FOUND",
            code: "NOT_FOUND",
        }, { status: 404 });
    }

    const responseData: Record<string, unknown> = {
        organizationId: result.data.organizationId,
        organizationName: result.data.organizationName,
        user: result.data.user,
        expiresAt: result.data.expiresAt,
    };

    if (process.env.NODE_ENV !== "production") {
        responseData.resetUrl = buildResetConfirmUrl(request, result.data.token);
    }

    logger.info("Agency password reset requested", {
        operation: "authReset.request",
        organizationId: result.data.organizationId,
        userId: result.data.user.id,
        actorUserId: access.auth?.userId ?? "unknown",
        actorRole: access.auth?.role ?? "admin",
    });

    return apiSuccess(request, responseData);
}

export const POST = withApiLogging("/api/auth/reset/request", "POST", POSTHandler);
