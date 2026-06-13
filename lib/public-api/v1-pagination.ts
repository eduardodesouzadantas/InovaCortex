import { PublicApiError } from "@/lib/public-api/v1-auth";

import type { PublicApiPaginationMeta } from "@/lib/public-api/v1-response";

type PublicApiPaginationOptions = {
    defaultLimit?: number;
    maxLimit?: number;
    defaultPage?: number;
};

type PublicApiPaginationParams = {
    limit: number;
    offset: number;
};

function parsePositiveInt(value: string | null, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function decodeCursor(cursor: string): number {
    try {
        const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { offset?: unknown };
        const offset = typeof parsed.offset === "number" ? parsed.offset : Number(parsed.offset);
        if (!Number.isFinite(offset) || offset < 0) {
            throw new Error("Invalid cursor offset");
        }
        return Math.floor(offset);
    } catch {
        throw new PublicApiError("Invalid cursor.", 400, "VALIDATION_ERROR");
    }
}

export function encodePublicApiCursor(offset: number): string {
    return Buffer.from(JSON.stringify({ offset: Math.max(0, Math.floor(offset)) }), "utf8").toString("base64url");
}

export function parsePublicApiPagination(searchParams: URLSearchParams, options: PublicApiPaginationOptions = {}): PublicApiPaginationParams {
    const defaultPage = options.defaultPage ?? 1;
    const defaultLimit = options.defaultLimit ?? 25;
    const maxLimit = options.maxLimit ?? 100;
    const requestedLimit = parsePositiveInt(searchParams.get("limit"), defaultLimit);
    const limit = Math.min(maxLimit, requestedLimit);
    const cursor = searchParams.get("cursor")?.trim();
    const page = searchParams.get("page")?.trim();

    if (cursor) {
        return {
            limit,
            offset: decodeCursor(cursor),
        };
    }

    const resolvedPage = parsePositiveInt(page ?? null, defaultPage);
    return {
        limit,
        offset: (resolvedPage - 1) * limit,
    };
}

export function buildPublicApiPaginationMeta(input: {
    offset: number;
    limit: number;
    total: number;
    returnedCount: number;
}): PublicApiPaginationMeta {
    const nextOffset = input.offset + input.returnedCount;
    const hasNextPage = nextOffset < input.total;

    return {
        limit: input.limit,
        total: input.total,
        returnedCount: input.returnedCount,
        hasNextPage,
        nextCursor: hasNextPage ? encodePublicApiCursor(nextOffset) : null,
    };
}

export type { PublicApiPaginationParams };
