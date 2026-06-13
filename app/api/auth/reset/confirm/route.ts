import { NextRequest, NextResponse } from "next/server";

import { confirmPasswordReset } from "@/lib/auth/password-reset-service";
import { apiError, apiSuccess } from "@/lib/http/api-response";
import { logger, withApiLogging } from "@/lib/logger";

export const runtime = "nodejs";

async function readRequestBody(request: NextRequest): Promise<{ token?: string; password?: string; confirmPassword?: string } | null> {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
        return request.json().catch(() => null);
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
        return null;
    }

    return {
        token: typeof formData.get("token") === "string" ? String(formData.get("token")) : undefined,
        password: typeof formData.get("password") === "string" ? String(formData.get("password")) : undefined,
        confirmPassword: typeof formData.get("confirmPassword") === "string" ? String(formData.get("confirmPassword")) : undefined,
    };
}

async function POSTHandler(request: NextRequest) {
    const queryToken = new URL(request.url).searchParams.get("token")?.trim() ?? "";
    const body = await readRequestBody(request);
    const token = (body?.token?.trim() ?? queryToken).trim();
    const password = (body?.password ?? "").trim();
    const confirmPassword = (body?.confirmPassword ?? "").trim();

    if (!token || !password) {
        return apiError(request, {
            message: "TOKEN_AND_PASSWORD_REQUIRED",
            code: "BAD_REQUEST",
        }, { status: 400 });
    }

    if (confirmPassword && confirmPassword !== password) {
        return apiError(request, {
            message: "PASSWORDS_DO_NOT_MATCH",
            code: "BAD_REQUEST",
        }, { status: 400 });
    }

    const result = await confirmPasswordReset({
        token,
        password,
    });

    if (!result.ok) {
        const status = result.reason === "expired_token" ? 410 : 400;
        return apiError(request, {
            message: result.reason === "expired_token" ? "TOKEN_EXPIRED" : result.reason === "weak_password" ? "WEAK_PASSWORD" : "INVALID_RESET_TOKEN",
            code: result.reason === "expired_token" ? "TOKEN_EXPIRED" : result.reason === "weak_password" ? "BAD_REQUEST" : "INVALID_RESET_TOKEN",
        }, { status });
    }

    logger.info("Password reset confirmed", {
        operation: "authReset.confirm",
        organizationId: result.organizationId,
        userId: result.userId,
    });

    return apiSuccess(request, {
        organizationId: result.organizationId,
        organizationName: result.organizationName,
        userId: result.userId,
    });
}

export const POST = withApiLogging("/api/auth/reset/confirm", "POST", POSTHandler);
