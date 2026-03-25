import { createHash } from "crypto";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
    createFallbackRateLimitStore,
    createInMemoryRateLimitStore,
    createPrismaRateLimitStore,
    type RateLimitStore,
} from "@/lib/auth/rate-limit-store";
import { resolveClientIp } from "@/lib/auth/client-ip";

export const AUTH_LOGIN_IDENTIFIER_LIMIT = 5;
export const AUTH_LOGIN_IP_LIMIT = 25;
export const AUTH_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const AUTH_PASSWORD_RESET_IDENTIFIER_LIMIT = 5;
export const AUTH_PASSWORD_RESET_IP_LIMIT = 25;
export const AUTH_INVITE_IDENTIFIER_LIMIT = 5;
export const AUTH_INVITE_IP_LIMIT = 25;

type AuthScope = "login" | "password_reset" | "invite";
type LoginEndpoint = "auth" | "agency" | "admin_adapter";
type RateLimitBucket = "identifier" | "ip";

export interface AuthRateLimitDecision {
    allowed: boolean;
    exceededBucket: RateLimitBucket | null;
    identifierHash: string;
    ip: string;
    retryAfterSeconds: number;
}

interface ConsumeAuthRateLimitInput {
    scope: AuthScope;
    request: Request;
    identifier: string;
    endpoint?: LoginEndpoint;
    organizationId?: string;
    now?: number;
}

let defaultStore: RateLimitStore | null = null;

function isTruthyFlag(value: string | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function normalizeIdentifier(identifier: string): string {
    const normalized = identifier.trim().toLowerCase();
    return normalized || "anonymous";
}

function hashValue(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function shouldUseSharedStore(): boolean {
    const configured = process.env.AUTH_RATE_LIMIT_STORE ?? "";
    if (configured === "database" || configured === "prisma") {
        return true;
    }

    if (configured === "memory") {
        return false;
    }

    return process.env.NODE_ENV === "production" || isTruthyFlag(process.env.AUTH_RATE_LIMIT_SHARED);
}

function describeRateLimitScope(key: string): string {
    if (key.startsWith("auth:login:")) return "login";
    if (key.startsWith("auth:password-reset:")) return "password_reset";
    if (key.startsWith("auth:invite:")) return "invite";
    return "unknown";
}

function logAuthRateLimitFallback(error: unknown, input: { key: string; windowMs: number }): void {
    logger.warn("Auth rate limit shared store unavailable; falling back to memory", {
        operation: "auth_rate_limit_store_fallback",
        result: "degraded",
        fallbackMode: "memory",
        sharedStore: "prisma",
        scope: describeRateLimitScope(input.key),
        windowMs: input.windowMs,
        error: error instanceof Error ? error.message : String(error),
    });
}

function getDefaultRateLimitStore(): RateLimitStore {
    if (defaultStore) {
        return defaultStore;
    }

    const fallback = createInMemoryRateLimitStore();

    if (!shouldUseSharedStore()) {
        defaultStore = fallback;
        return defaultStore;
    }

    const sharedStore = createPrismaRateLimitStore(prisma);
    defaultStore = createFallbackRateLimitStore(sharedStore, fallback, logAuthRateLimitFallback);

    return defaultStore;
}

function buildRateLimitKey(input: {
    scope: AuthScope;
    endpoint?: LoginEndpoint;
    organizationId?: string;
    bucket: RateLimitBucket;
    identifierHash: string;
    ip: string;
}): string {
    const prefix = input.scope === "login"
        ? `auth:login:${input.endpoint ?? "auth"}`
        : input.scope === "password_reset"
            ? `auth:password-reset:${input.organizationId ?? "unknown-org"}`
            : `auth:invite:${input.organizationId ?? "unknown-org"}`;

    const suffix = input.bucket === "identifier"
        ? input.identifierHash
        : hashValue(input.ip);

    return `${prefix}:${input.bucket}:${suffix}:${input.ip}`;
}

function getLimitConfig(scope: AuthScope): { identifierLimit: number; ipLimit: number; windowMs: number } {
    switch (scope) {
        case "password_reset":
            return {
                identifierLimit: AUTH_PASSWORD_RESET_IDENTIFIER_LIMIT,
                ipLimit: AUTH_PASSWORD_RESET_IP_LIMIT,
                windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
            };
        case "invite":
            return {
                identifierLimit: AUTH_INVITE_IDENTIFIER_LIMIT,
                ipLimit: AUTH_INVITE_IP_LIMIT,
                windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
            };
        case "login":
        default:
            return {
                identifierLimit: AUTH_LOGIN_IDENTIFIER_LIMIT,
                ipLimit: AUTH_LOGIN_IP_LIMIT,
                windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
            };
    }
}

async function consumeAuthRateLimit(input: ConsumeAuthRateLimitInput): Promise<AuthRateLimitDecision> {
    const now = input.now ?? Date.now();
    const ip = resolveClientIp(input.request);
    const identifierHash = hashValue(normalizeIdentifier(input.identifier));
    const config = getLimitConfig(input.scope);
    const store = getDefaultRateLimitStore();

    const identifierBucket = await store.consume({
        key: buildRateLimitKey({
            scope: input.scope,
            endpoint: input.endpoint,
            organizationId: input.organizationId,
            bucket: "identifier",
            identifierHash,
            ip,
        }),
        windowMs: config.windowMs,
        now,
    });

    const ipBucket = await store.consume({
        key: buildRateLimitKey({
            scope: input.scope,
            endpoint: input.endpoint,
            organizationId: input.organizationId,
            bucket: "ip",
            identifierHash,
            ip,
        }),
        windowMs: config.windowMs,
        now,
    });

    const exceededIdentifier = identifierBucket.count > config.identifierLimit;
    const exceededIp = ipBucket.count > config.ipLimit;

    if (exceededIdentifier || exceededIp) {
        const retryAfterSeconds = Math.max(
            1,
            Math.ceil((Math.max(identifierBucket.resetAt, ipBucket.resetAt) - now) / 1000),
        );

        return {
            allowed: false,
            exceededBucket: exceededIdentifier ? "identifier" : "ip",
            identifierHash,
            ip,
            retryAfterSeconds,
        };
    }

    return {
        allowed: true,
        exceededBucket: null,
        identifierHash,
        ip,
        retryAfterSeconds: 0,
    };
}

export function clearAuthRateLimitState(): Promise<void> {
    const store = getDefaultRateLimitStore();
    return store.clear();
}

export function consumeAuthLoginRateLimit(input: {
    endpoint: LoginEndpoint;
    identifier: string;
    request: Request;
    now?: number;
}): Promise<AuthRateLimitDecision> {
    return consumeAuthRateLimit({
        scope: "login",
        endpoint: input.endpoint,
        identifier: input.identifier,
        request: input.request,
        now: input.now,
    });
}

export function consumePasswordResetRateLimit(input: {
    organizationId: string;
    userId: string;
    request: Request;
    now?: number;
}): Promise<AuthRateLimitDecision> {
    return consumeAuthRateLimit({
        scope: "password_reset",
        organizationId: input.organizationId,
        identifier: input.userId,
        request: input.request,
        now: input.now,
    });
}

export function consumeInviteRateLimit(input: {
    organizationId: string;
    email: string;
    request: Request;
    now?: number;
}): Promise<AuthRateLimitDecision> {
    return consumeAuthRateLimit({
        scope: "invite",
        organizationId: input.organizationId,
        identifier: input.email,
        request: input.request,
        now: input.now,
    });
}

export function resolveAuthLoginClientIp(request: Request): string {
    return resolveClientIp(request);
}

export function resetAuthRateLimitStoreForTesting(): void {
    defaultStore = null;
}
