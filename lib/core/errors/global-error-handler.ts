import { apiError, resolveRequestId } from "@/lib/http/api-response";
import { logError } from "@/lib/core/observability/logger";

type HandleApiErrorOptions = {
    requestId?: string;
    status?: number;
    fallbackCode?: string;
    fallbackMessage?: string;
    logContext?: Record<string, unknown>;
};

type ErrorShape = {
    code?: string;
    message?: string;
    status?: number;
};

function sanitizeMessage(message: string): string {
    return message
        .replace(/(access[_-]?token|refresh[_-]?token|authorization|password|secret)=([^&\s]+)/gi, "$1=[REDACTED]")
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
        .slice(0, 500);
}

function parseError(error: unknown): ErrorShape {
    if (error && typeof error === "object") {
        const value = error as Record<string, unknown>;
        return {
            code: typeof value.code === "string" ? value.code : undefined,
            message: typeof value.message === "string" ? value.message : undefined,
            status: typeof value.status === "number" ? value.status : undefined,
        };
    }

    if (error instanceof Error) {
        return { message: error.message };
    }

    return {};
}

export function handleApiError(request: Request, error: unknown, options: HandleApiErrorOptions = {}) {
    const parsed = parseError(error);
    const requestId = options.requestId ?? resolveRequestId(request);
    const status = parsed.status ?? options.status ?? 500;
    const code = parsed.code ?? options.fallbackCode ?? "INTERNAL_ERROR";
    const message = sanitizeMessage(parsed.message ?? options.fallbackMessage ?? "Internal Error");

    logError("api_error_handled", {
        requestId,
        module: "api",
        code,
        status,
        message,
        ...options.logContext,
    });

    return apiError(
        request,
        { code, message },
        { status, requestId },
    );
}

