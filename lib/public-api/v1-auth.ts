import crypto from "crypto";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { setRequestContext } from "@/lib/observability/request-context";
import { isOrganizationSuspended } from "@/lib/billing/account-status";
import {
    publicApiErrorResponse as buildPublicApiErrorResponse,
    type PublicApiRateLimitSnapshot,
    type PublicApiErrorOptions,
} from "@/lib/public-api/v1-response";

const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 60;
const RATE_LIMIT_BUCKETS = new Map<string, { count: number; resetAt: number }>();

export class PublicApiError extends Error {
    status: number;
    code: string;
    details?: unknown;
    headers?: HeadersInit;

    constructor(
        message: string,
        status: number,
        code: string,
        details?: unknown,
        headers?: HeadersInit,
    ) {
        super(message);
        this.name = "PublicApiError";
        this.status = status;
        this.code = code;
        this.details = details;
        this.headers = headers;
    }
}

export interface PublicApiRequestContext {
    organizationId: string;
    organizationSlug: string;
    organizationName: string;
    apiKeyId: string;
    apiKeyName: string;
    apiKeyPrefix: string;
}

export interface PublicApiKeyRecord {
    id: string;
    organizationId: string;
    name: string;
    keyPrefix: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PublicApiRateLimitInfo extends PublicApiRateLimitSnapshot {}

function normalizeInput(value: string | null | undefined): string {
    return typeof value === "string" ? value.trim() : "";
}

export function hashPublicApiKey(rawKey: string): string {
    return crypto.createHash("sha256").update(rawKey.trim()).digest("hex");
}

export function generatePublicApiKeyValue(prefix = "icx_pub"): { rawKey: string; keyPrefix: string; keyHash: string } {
    const normalizedPrefix = prefix.trim() || "icx_pub";
    const secret = crypto.randomBytes(32).toString("hex");
    const rawKey = `${normalizedPrefix}_${secret}`;

    return {
        rawKey,
        keyPrefix: rawKey.slice(0, 16),
        keyHash: hashPublicApiKey(rawKey),
    };
}

export async function provisionPublicApiKey(input: {
    organizationId: string;
    name: string;
    prefix?: string;
}): Promise<{ rawKey: string; key: PublicApiKeyRecord }> {
    const token = generatePublicApiKeyValue(input.prefix);
    const name = normalizeInput(input.name);

    if (!name) {
        throw new PublicApiError("API key name is required.", 400, "INVALID_API_KEY_NAME");
    }

    const key = await prisma.publicApiKey.create({
        data: {
            organizationId: input.organizationId,
            name,
            keyPrefix: token.keyPrefix,
            keyHash: token.keyHash,
        },
        select: {
            id: true,
            organizationId: true,
            name: true,
            keyPrefix: true,
            lastUsedAt: true,
            revokedAt: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return {
        rawKey: token.rawKey,
        key: {
            ...key,
            lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
            revokedAt: key.revokedAt ? key.revokedAt.toISOString() : null,
            createdAt: key.createdAt.toISOString(),
            updatedAt: key.updatedAt.toISOString(),
        },
    };
}

function extractBearerToken(request: Request): string {
    const authorization = request.headers.get("authorization") ?? request.headers.get("Authorization");
    const normalized = normalizeInput(authorization);
    if (!normalized) {
        throw new PublicApiError("API key is required.", 401, "UNAUTHORIZED");
    }

    const [scheme, ...rest] = normalized.split(/\s+/);
    if (!scheme || scheme.toLowerCase() !== "bearer" || rest.length === 0) {
        throw new PublicApiError("API key is required.", 401, "UNAUTHORIZED");
    }

    const rawToken = rest.join(" ").trim();
    if (!rawToken) {
        throw new PublicApiError("API key is required.", 401, "UNAUTHORIZED");
    }

    return rawToken;
}

export async function authenticatePublicApiRequest(request: Request): Promise<PublicApiRequestContext> {
    const rawToken = extractBearerToken(request);
    const keyHash = hashPublicApiKey(rawToken);

    const publicApiKey = await prisma.publicApiKey.findFirst({
        where: {
            keyHash,
            revokedAt: null,
        },
        select: {
            id: true,
            name: true,
            keyPrefix: true,
            organization: {
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    subscriptionStatus: true,
                },
            },
        },
    });

    if (!publicApiKey) {
        throw new PublicApiError("API key inválida.", 401, "UNAUTHORIZED");
    }

    if (isOrganizationSuspended(publicApiKey.organization.subscriptionStatus)) {
        throw new PublicApiError(
            "Conta suspensa. Regularize o billing para continuar.",
            403,
            "FORBIDDEN",
            { accountStatus: "suspended" },
        );
    }

    setRequestContext({
        organizationId: publicApiKey.organization.id,
        organizationSlug: publicApiKey.organization.slug,
        operation: "public_api_request",
    });

    await prisma.publicApiKey.update({
        where: { id: publicApiKey.id },
        data: { lastUsedAt: new Date() },
    }).catch((error: unknown) => {
        logger.warn("Failed to update public API key usage", {
            apiKeyId: publicApiKey.id,
            error: error instanceof Error ? error.message : String(error),
        });
    });

    return {
        organizationId: publicApiKey.organization.id,
        organizationSlug: publicApiKey.organization.slug,
        organizationName: publicApiKey.organization.name,
        apiKeyId: publicApiKey.id,
        apiKeyName: publicApiKey.name,
        apiKeyPrefix: publicApiKey.keyPrefix,
    };
}

export function enforcePublicApiRateLimit(input: {
    organizationId: string;
    apiKeyId: string;
    routeKey: string;
    limit?: number;
    windowMs?: number;
}): PublicApiRateLimitInfo {
    const limit = input.limit ?? DEFAULT_RATE_LIMIT_MAX_REQUESTS;
    const windowMs = input.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
    const now = Date.now();
    const bucketKey = `${input.organizationId}:${input.apiKeyId}:${input.routeKey}`;
    const existing = RATE_LIMIT_BUCKETS.get(bucketKey);

    if (existing && existing.resetAt <= now) {
        RATE_LIMIT_BUCKETS.delete(bucketKey);
    }

    const bucket = RATE_LIMIT_BUCKETS.get(bucketKey) ?? {
        count: 0,
        resetAt: now + windowMs,
    };

    bucket.count += 1;
    RATE_LIMIT_BUCKETS.set(bucketKey, bucket);

    if (bucket.count > limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        throw new PublicApiError(
            "Too many requests. Try again later.",
            429,
            "TOO_MANY_REQUESTS",
            { retryAfterSeconds },
            {
                "Retry-After": String(retryAfterSeconds),
                "X-RateLimit-Limit": String(limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000)),
            },
        );
    }

    return {
        limit,
        remaining: Math.max(0, limit - bucket.count),
        resetAt: new Date(bucket.resetAt),
    };
}

export async function authenticateAndRateLimitPublicApiRequest(request: Request, input: {
    routeKey: string;
    limit?: number;
    windowMs?: number;
}): Promise<{
    context: PublicApiRequestContext;
    rateLimit: PublicApiRateLimitInfo;
}> {
    const context = await authenticatePublicApiRequest(request);
    setRequestContext({
        organizationId: context.organizationId,
        organizationSlug: context.organizationSlug,
        operation: "public_api_request",
    });
    const rateLimit = enforcePublicApiRateLimit({
        organizationId: context.organizationId,
        apiKeyId: context.apiKeyId,
        routeKey: input.routeKey,
        limit: input.limit,
        windowMs: input.windowMs,
    });

    return {
        context,
        rateLimit,
    };
}

export async function runPublicApiRequest<T>(request: Request, input: {
    routeKey: string;
    limit?: number;
    windowMs?: number;
    handler: (context: PublicApiRequestContext) => Promise<T>;
}): Promise<T> {
    const { context } = await authenticateAndRateLimitPublicApiRequest(request, {
        routeKey: input.routeKey,
        limit: input.limit,
        windowMs: input.windowMs,
    });

    return input.handler(context);
}

export function clearPublicApiRateLimitState(): void {
    RATE_LIMIT_BUCKETS.clear();
}

export function publicApiErrorResponse(request: Request, error: unknown, options: PublicApiErrorOptions = {}): Response {
    if (error instanceof PublicApiError) {
        return buildPublicApiErrorResponse(
            request,
            {
                code: error.code,
                message: error.message,
                ...(typeof error.details === "undefined" ? {} : { details: error.details }),
            },
            {
                status: error.status,
                headers: error.headers,
                requestId: options.requestId,
                rateLimit: options.rateLimit,
            },
        );
    }

    logger.error("Unhandled public API error", {
        error: error instanceof Error ? error.message : String(error),
    });

    return buildPublicApiErrorResponse(request, {
        code: "INTERNAL_ERROR",
        message: "Internal Server Error",
    }, {
        requestId: options.requestId,
        rateLimit: options.rateLimit,
    });
}
