/**
 * lib/logger.ts
 * Compatibility wrapper around the observability logger plus API route logging.
 */

import { ZodError } from "zod";

import { isApiRouteError } from "@/lib/http/route-errors";
import { recordRequestMetric } from "@/lib/observability/metrics";
import {
    logger as structuredLogger,
    log as structuredLog,
    type LogContext,
    type LogLevel,
} from "@/lib/observability/logger";
import {
    createRequestId,
    resolveRequestIdFromHeaders,
    runWithRequestContext,
} from "@/lib/observability/request-context";

export type { LogContext, LogLevel } from "@/lib/observability/logger";

export type ApiHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
type ApiResponseLike = Response | { status?: number } | unknown;
type ApiSuccessBody = { success: true; data: unknown; meta: Record<string, unknown> };
type ApiErrorBody = { success: false; error: string; code: string; details?: unknown };

export const logger = structuredLogger;
export const log = structuredLog;

function resolveRequestFromArgs(args: any[]): Request | null {
    const first = args[0];
    if (first instanceof Request) return first;
    return null;
}

function resolveStatusFromResponse(response: ApiResponseLike): number {
    if (response instanceof Response) return response.status;
    if (response && typeof response === "object" && "status" in response) {
        const status = (response as { status?: unknown }).status;
        if (typeof status === "number") return status;
    }
    return 200;
}

function normalizeDuration(startedAt: number): string {
    return `${Date.now() - startedAt}ms`;
}

function inferErrorStatus(error: unknown): number {
    if (error instanceof Response) return error.status || 500;
    if (isApiRouteError(error)) return error.status;
    if (error instanceof ZodError) return 422;
    if (error && typeof error === "object" && "status" in error) {
        const status = (error as { status?: unknown }).status;
        if (typeof status === "number") return status;
    }
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

    if (message.includes("unauthenticated") || message.includes("unauthorized")) return 401;
    if (message.includes("forbidden")) return 403;
    if (message.includes("not found") || message.includes("org_not_found") || message.includes("p2025")) return 404;
    if (
        message.includes("validation")
        || message.includes("unprocessable")
        || message.includes("invalid_payload")
        || message.includes("zod")
    ) return 422;
    if (message.includes("conflict") || message.includes("already exists") || message.includes("duplicate")) return 409;
    if (
        message.includes("failed_dependency")
        || message.includes("ai_engine_unavailable")
        || message.includes("openai_api_key_missing")
        || message.includes("openai")
    ) {
        return 424;
    }
    if (message.includes("rate limit") || message.includes("too many requests")) return 429;
    if (
        message.includes("invalid") ||
        message.includes("required") ||
        message.includes("missing") ||
        message.includes("malformed") ||
        message.includes("json") ||
        message.includes("parse")
    ) {
        return 400;
    }
    if (message.includes("timeout") || message.includes("timed out")) return 500;
    return 500;
}

const ALLOWED_STATUS_CODES = new Set([200, 201, 202, 400, 401, 403, 404, 409, 422, 424, 429, 500, 502, 503, 504]);

function normalizeStatusCode(status: number): number {
    if (ALLOWED_STATUS_CODES.has(status)) return status;
    if (status >= 200 && status < 300) return 200;
    if (status === 409) return 409;
    if (status === 422) return 422;
    if (status === 424) return 424;
    if (status === 429) return 429;
    if (status === 401) return 401;
    if (status === 403) return 403;
    if (status === 404) return 404;
    if (status === 502) return 502;
    if (status === 503) return 503;
    if (status === 504) return 504;
    if (status >= 400 && status < 500) return 400;
    return 500;
}

function defaultErrorCodeForStatus(status: number): string {
    if (status === 400) return "BAD_REQUEST";
    if (status === 401) return "UNAUTHORIZED";
    if (status === 403) return "FORBIDDEN";
    if (status === 404) return "NOT_FOUND";
    if (status === 409) return "CONFLICT";
    if (status === 422) return "VALIDATION_ERROR";
    if (status === 424) return "FAILED_DEPENDENCY";
    if (status === 429) return "TOO_MANY_REQUESTS";
    if (status === 502) return "BAD_GATEWAY";
    if (status === 503) return "SERVICE_UNAVAILABLE";
    if (status === 504) return "GATEWAY_TIMEOUT";
    return "INTERNAL_ERROR";
}

function toErrorBody(
    payload: unknown,
    status: number,
): ApiErrorBody {
    const fallbackCode = defaultErrorCodeForStatus(status);
    const fallbackError = status >= 500 ? "Internal Server Error" : "Request failed";

    if (payload && typeof payload === "object") {
        const body = payload as Record<string, unknown>;
        const topCode = typeof body.code === "string" && body.code.trim() ? body.code : null;
        const topError = body.error;
        const topMessage = typeof body.message === "string" ? body.message : null;
        const topDetails = "details" in body ? body.details : undefined;
        const preserveExplicitServerMessage =
            status >= 500
            && topCode !== null
            && topCode !== "INTERNAL_ERROR";

        if (typeof topError === "string" && topError.trim()) {
            return {
                success: false,
                error: status >= 500 && !preserveExplicitServerMessage ? "Internal Server Error" : topError,
                code: topCode ?? fallbackCode,
                ...(typeof topDetails === "undefined" ? {} : { details: topDetails }),
            };
        }

        if (topError && typeof topError === "object") {
            const nested = topError as Record<string, unknown>;
            const nestedMessage =
                typeof nested.message === "string" && nested.message.trim()
                    ? nested.message
                    : fallbackError;
            const nestedCode =
                typeof nested.code === "string" && nested.code.trim()
                    ? nested.code
                    : fallbackCode;

            return {
                success: false,
                error: status >= 500 && !preserveExplicitServerMessage ? "Internal Server Error" : nestedMessage,
                code: topCode ?? nestedCode,
                ...(typeof topDetails === "undefined" ? {} : { details: topDetails }),
            };
        }

        if (typeof topMessage === "string" && topMessage.trim()) {
            return {
                success: false,
                error: status >= 500 && !preserveExplicitServerMessage ? "Internal Server Error" : topMessage,
                code: topCode ?? fallbackCode,
                ...(typeof topDetails === "undefined" ? {} : { details: topDetails }),
            };
        }
    }

    if (typeof payload === "string" && payload.trim()) {
        return {
            success: false,
            error: status >= 500 ? "Internal Server Error" : payload,
            code: fallbackCode,
        };
    }

    return {
        success: false,
        error: fallbackError,
        code: fallbackCode,
    };
}

function toSuccessBody(payload: unknown, requestId?: string): ApiSuccessBody {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const body = payload as Record<string, unknown>;

        if (body.success === true && "data" in body) {
            const meta =
                body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
                    ? { ...(body.meta as Record<string, unknown>) }
                    : {};

            if (requestId && meta.requestId == null) {
                meta.requestId = requestId;
            }

            return {
                success: true,
                data: body.data,
                meta,
            };
        }
    }

    const meta: Record<string, unknown> = {};
    if (requestId) meta.requestId = requestId;

    return {
        success: true,
        data: payload ?? null,
        meta,
    };
}

function buildApiErrorResponse(status: number, payload: unknown, requestId?: string): Response {
    const normalizedStatus = normalizeStatusCode(status);
    const body = toErrorBody(payload, normalizedStatus);

    const headers: HeadersInit = {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
    };
    if (requestId) headers["x-request-id"] = requestId;

    return new Response(JSON.stringify(body), { status: normalizedStatus, headers });
}

function isJsonResponse(response: Response): boolean {
    const contentType = response.headers.get("content-type") ?? "";
    return contentType.includes("application/json") || contentType.includes("text/json");
}

function isRedirectStatus(status: number): boolean {
    return status >= 300 && status < 400;
}

async function normalizeApiResponse(
    response: ApiResponseLike,
    requestId?: string,
): Promise<ApiResponseLike> {
    if (!(response instanceof Response)) return response;
    if (isRedirectStatus(response.status)) return response;

    const normalizedStatus = normalizeStatusCode(response.status);
    const headers = new Headers(response.headers);
    if (requestId) headers.set("x-request-id", requestId);

    const shouldParseAsJson = isJsonResponse(response) || normalizedStatus >= 400;
    if (!shouldParseAsJson) {
        if (normalizedStatus === response.status) return response;
        return new Response(await response.clone().arrayBuffer(), {
            status: normalizedStatus,
            headers,
        });
    }

    const raw = await response.clone().text();
    let parsed: unknown = null;
    if (raw.trim()) {
        try {
            parsed = JSON.parse(raw);
        } catch {
            parsed = raw;
        }
    }

    headers.set("content-type", "application/json; charset=utf-8");

    if (normalizedStatus >= 200 && normalizedStatus < 300) {
        const body = toSuccessBody(parsed, requestId);
        return new Response(JSON.stringify(body), {
            status: normalizedStatus,
            headers,
        });
    }

    const body = toErrorBody(parsed, normalizedStatus);
    return new Response(JSON.stringify(body), {
        status: normalizedStatus,
        headers,
    });
}

async function validateRequestJsonShape(
    request: Request | null,
    method: ApiHttpMethod,
    requestId?: string,
): Promise<Response | null> {
    if (!request) return null;
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;

    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) === 0) return null;

    try {
        await request.clone().json();
        return null;
    } catch {
        return buildApiErrorResponse(400, "Invalid JSON body", requestId);
    }
}

export function withApiLogging<T extends (...args: any[]) => any>(
    route: string,
    method: ApiHttpMethod,
    handler: T,
    options: { timeoutMs?: number } = {}
): (...args: Parameters<T>) => ReturnType<T> {
    const TIMEOUT_MS = options.timeoutMs ?? 30000; // Default 30s

    return (async (...args: Parameters<T>) => {
        const request = resolveRequestFromArgs(args);
        const requestId = request ? resolveRequestIdFromHeaders(request.headers) : createRequestId();

        return runWithRequestContext({
            requestId,
            route,
            method,
            operation: `${route}:${method}`,
        }, async () => {
            const startedAt = Date.now();

            logger.info(`[API] ${route} ${method} 0ms START`, {
                route,
                method,
                duration: "0ms",
                status: "START",
                requestId,
            });

            try {
                const validationError = await validateRequestJsonShape(request, method, requestId);
                if (validationError) {
                    const duration = normalizeDuration(startedAt);
                    recordRequestMetric({
                        route,
                        method,
                        status: 400,
                        durationMs: Date.now() - startedAt,
                    });
                    logger.warn(`[API] ${route} ${method} ${duration} 400`, {
                        route,
                        method,
                        duration,
                        status: 400,
                        requestId,
                        error: "Invalid JSON body",
                    });
                    return validationError as ReturnType<T>;
                }

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Request timeout")), TIMEOUT_MS)
                );

                const response = await Promise.race([handler(...args), timeoutPromise]);
                const normalizedResponse = await normalizeApiResponse(response, requestId);
                const normalizedStatus = resolveStatusFromResponse(normalizedResponse);
                const duration = normalizeDuration(startedAt);
                recordRequestMetric({
                    route,
                    method,
                    status: normalizedStatus,
                    durationMs: Date.now() - startedAt,
                });

                logger.info(`[API] ${route} ${method} ${duration} ${normalizedStatus}`, {
                    route,
                    method,
                    duration,
                    status: normalizedStatus,
                    requestId,
                });
                return normalizedResponse as ReturnType<T>;
            } catch (error) {
                const duration = normalizeDuration(startedAt);
                const status = normalizeStatusCode(inferErrorStatus(error));
                const message = error instanceof Error ? error.message : String(error);
                recordRequestMetric({
                    route,
                    method,
                    status,
                    durationMs: Date.now() - startedAt,
                });

                logger.error(`[API] ${route} ${method} ${duration} ${status}`, {
                    route,
                    method,
                    duration,
                    status,
                    requestId,
                    error: message,
                });

                if (error instanceof Response) {
                    const normalized = await normalizeApiResponse(error, requestId);
                    return normalized as ReturnType<T>;
                }

                if (isApiRouteError(error)) {
                    return buildApiErrorResponse(status, {
                        error: error.message,
                        code: error.code,
                        details: error.details,
                    }, requestId) as ReturnType<T>;
                }

                if (error instanceof ZodError) {
                    return buildApiErrorResponse(422, {
                        error: "INVALID_PAYLOAD",
                        code: "INVALID_PAYLOAD",
                        details: error.issues.map((issue) => ({
                            path: issue.path.map(String).join("."),
                            message: issue.message,
                            code: issue.code,
                        })),
                    }, requestId) as ReturnType<T>;
                }

                return buildApiErrorResponse(status, message, requestId) as ReturnType<T>;
            }
        });
    }) as (...args: Parameters<T>) => ReturnType<T>;
}
