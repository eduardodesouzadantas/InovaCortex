import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export const PUBLIC_API_VERSION = "v1";

type PublicApiRateLimitSnapshot = {
    limit: number;
    remaining: number;
    resetAt: Date;
};

type PublicApiPaginationMeta = {
    limit: number;
    total: number;
    returnedCount: number;
    hasNextPage: boolean;
    nextCursor: string | null;
};

type PublicApiSuccessOptions = {
    status?: number;
    requestId?: string;
    headers?: HeadersInit;
    rateLimit?: PublicApiRateLimitSnapshot;
    pagination?: PublicApiPaginationMeta;
};

type PublicApiErrorBody = {
    code: string;
    message: string;
    details?: unknown;
};

type PublicApiErrorOptions = {
    status?: number;
    requestId?: string;
    headers?: HeadersInit;
    rateLimit?: PublicApiRateLimitSnapshot;
};

const REQUEST_ID_HEADER = "x-request-id";
const FALLBACK_REQUEST_ID_HEADER = "x-correlation-id";
const RATE_LIMIT_LIMIT_HEADER = "x-ratelimit-limit";
const RATE_LIMIT_REMAINING_HEADER = "x-ratelimit-remaining";
const RATE_LIMIT_RESET_HEADER = "x-ratelimit-reset";

function sanitizeRequestId(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 128) return null;
    return trimmed;
}

export function resolvePublicApiRequestId(request: Request): string {
    const requestId = sanitizeRequestId(request.headers.get(REQUEST_ID_HEADER));
    if (requestId) return requestId;

    const fallback = sanitizeRequestId(request.headers.get(FALLBACK_REQUEST_ID_HEADER));
    if (fallback) return fallback;

    return `req_${randomUUID()}`;
}

function normalizeHeaders(initHeaders: HeadersInit | undefined): Headers {
    return new Headers(initHeaders);
}

function applyOperationalHeaders(
    headers: Headers,
    requestId: string,
    rateLimit?: PublicApiRateLimitSnapshot,
): Headers {
    headers.set(REQUEST_ID_HEADER, requestId);

    if (rateLimit) {
        headers.set(RATE_LIMIT_LIMIT_HEADER, String(rateLimit.limit));
        headers.set(RATE_LIMIT_REMAINING_HEADER, String(rateLimit.remaining));
        headers.set(RATE_LIMIT_RESET_HEADER, String(Math.ceil(rateLimit.resetAt.getTime() / 1000)));
    }

    return headers;
}

export function normalizePublicApiErrorCode(code: string): string {
    const normalized = code.trim().toUpperCase();

    switch (normalized) {
        case "UNAUTHORIZED":
            return "unauthorized";
        case "FORBIDDEN":
            return "forbidden";
        case "TOO_MANY_REQUESTS":
            return "rate_limited";
        case "VALIDATION_ERROR":
            return "invalid_request";
        case "NOT_FOUND":
            return "not_found";
        case "CONFLICT":
            return "conflict";
        case "INTERNAL_ERROR":
            return "internal_error";
        default:
            return "internal_error";
    }
}

export function publicApiSuccessResponse<T>(request: Request, data: T, options: PublicApiSuccessOptions = {}): Response {
    const requestId = options.requestId ?? resolvePublicApiRequestId(request);
    const headers = applyOperationalHeaders(normalizeHeaders(options.headers), requestId, options.rateLimit);

    return NextResponse.json(
        {
            data,
            meta: {
                requestId,
                timestamp: new Date().toISOString(),
                version: PUBLIC_API_VERSION,
                ...(options.pagination ? { pagination: options.pagination } : {}),
            },
            error: null,
        },
        {
            status: options.status ?? 200,
            headers,
        },
    );
}

export function publicApiErrorResponse(request: Request, error: PublicApiErrorBody, options: PublicApiErrorOptions = {}): Response {
    const requestId = options.requestId ?? resolvePublicApiRequestId(request);
    const headers = applyOperationalHeaders(normalizeHeaders(options.headers), requestId, options.rateLimit);

    return NextResponse.json(
        {
            data: null,
            meta: {
                requestId,
                timestamp: new Date().toISOString(),
                version: PUBLIC_API_VERSION,
            },
            error: {
                code: normalizePublicApiErrorCode(error.code),
                message: error.message,
                ...(typeof error.details === "undefined" ? {} : { details: error.details }),
            },
        },
        {
            status: options.status ?? 500,
            headers,
        },
    );
}

export type {
    PublicApiErrorBody,
    PublicApiPaginationMeta,
    PublicApiRateLimitSnapshot,
    PublicApiSuccessOptions,
    PublicApiErrorOptions,
};
