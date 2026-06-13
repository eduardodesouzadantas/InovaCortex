import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

const REQUEST_ID_HEADER = "x-request-id";
const FALLBACK_REQUEST_ID_HEADER = "x-correlation-id";

type ApiErrorInput = {
    code: string;
    message: string;
    details?: unknown;
};

type ResponseInitInput = {
    status?: number;
    headers?: HeadersInit;
    requestId?: string;
};

function sanitizeRequestId(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > 128) return null;
    return trimmed;
}

export function resolveRequestId(request: Request): string {
    const requestId = sanitizeRequestId(request.headers.get(REQUEST_ID_HEADER));
    if (requestId) return requestId;

    const fallback = sanitizeRequestId(request.headers.get(FALLBACK_REQUEST_ID_HEADER));
    if (fallback) return fallback;

    return randomUUID();
}

function responseHeaders(headers: HeadersInit | undefined, requestId: string): Headers {
    const merged = new Headers(headers);
    merged.set(REQUEST_ID_HEADER, requestId);
    return merged;
}

export function apiSuccess<T>(request: Request, data: T, init?: ResponseInitInput) {
    const requestId = init?.requestId ?? resolveRequestId(request);
    return NextResponse.json(
        {
            success: true,
            data,
            meta: {
                requestId,
            },
        },
        { status: init?.status ?? 200, headers: responseHeaders(init?.headers, requestId) },
    );
}

export function apiError(request: Request, error: ApiErrorInput, init?: ResponseInitInput) {
    const requestId = init?.requestId ?? resolveRequestId(request);
    return NextResponse.json(
        {
            success: false,
            error: error.message,
            code: error.code,
            ...(typeof error.details === "undefined" ? {} : { details: error.details }),
        },
        { status: init?.status ?? 500, headers: responseHeaders(init?.headers, requestId) },
    );
}
