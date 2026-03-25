import { NextResponse } from "next/server";

import { apiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/prisma";
import {
    getAgencyOrgSlug,
    hashPassword,
    resolveAuthContext,
    setSessionCookie,
    type AuthScope,
    type SessionPayload,
    verifyPassword,
} from "@/lib/auth/session";
import {
    consumeAuthLoginRateLimit,
    type AuthLoginRateLimitDecision,
} from "@/lib/auth/login-rate-limit";
import { logger } from "@/lib/logger";
import { isDatabaseUnavailableError } from "@/lib/system/db-check";
import { trackEvent } from "@/app/services/identityEvents/identityEvent.service";

const VALID_SESSION_ROLES: ReadonlySet<SessionPayload["role"]> = new Set([
    "owner",
    "admin",
    "closer",
    "viewer",
]);

export interface LoginSuccessPayload {
    success: true;
    orgSlug: string;
    role: SessionPayload["role"];
    authScope: AuthScope;
}

interface LoginOptions {
    endpoint: "auth" | "agency" | "admin_adapter";
    requireScope?: AuthScope;
}

interface AdminBootstrapCredentials {
    email: string;
    password: string;
    name?: string;
}

function normalizeSessionRole(role: string): SessionPayload["role"] | null {
    const normalized = role.toLowerCase() as SessionPayload["role"];
    return VALID_SESSION_ROLES.has(normalized) ? normalized : null;
}

function isAgencyOrganization(orgSlug: string): boolean {
    return orgSlug.trim().toLowerCase() === getAgencyOrgSlug();
}

function unauthorizedResponse(request: Request) {
    return apiError(request, {
        message: "INVALID_CREDENTIALS",
        code: "UNAUTHORIZED",
    }, { status: 401 });
}

function rateLimitedResponse(
    request: Request,
    options: LoginOptions,
    rateLimit: AuthLoginRateLimitDecision,
) {
    logger.warn("Login rate limit exceeded", {
        operation: "auth_login_rate_limit",
        result: "blocked",
        endpoint: options.endpoint,
        bucket: rateLimit.exceededBucket,
        identifierHash: rateLimit.identifierHash,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
    });

    void trackEvent({
        type: "LOGIN_FAILED",
        metadata: {
            endpoint: options.endpoint,
            reason: "rate_limited",
            bucket: rateLimit.exceededBucket,
            identifierHash: rateLimit.identifierHash,
        },
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

function resolveAdminBootstrapCredentials(): AdminBootstrapCredentials | null {
    const email = (process.env.ADMIN_EMAIL ?? process.env.INITIAL_ADMIN_EMAIL ?? "").trim().toLowerCase();
    const password = (process.env.ADMIN_PASSWORD ?? process.env.INITIAL_ADMIN_PASSWORD ?? "").trim();
    const name = (process.env.ADMIN_NAME ?? process.env.INITIAL_ADMIN_NAME ?? "").trim();

    if (!email || !password) {
        return null;
    }

    return { email, password, name: name || undefined };
}

async function ensureAgencyAdminBootstrap(email: string, options: LoginOptions): Promise<void> {
    if (options.requireScope !== "agency") {
        return;
    }

    const bootstrap = resolveAdminBootstrapCredentials();
    if (!bootstrap || bootstrap.email !== email) {
        return;
    }

    const existingUser = await prisma.user.findUnique({
        where: { email: bootstrap.email },
        select: { id: true },
    });

    if (existingUser) {
        return;
    }

    const agencyOrgSlug = getAgencyOrgSlug();
    const organization = await prisma.organization.upsert({
        where: { slug: agencyOrgSlug },
        update: {},
        create: {
            name: "InovaCortex",
            slug: agencyOrgSlug,
            plan: "enterprise",
            industry: "Technology",
            maxAssessmentsPerMonth: 1000,
            maxUsers: 100,
        },
        select: { id: true, slug: true },
    });

    const passwordHash = await hashPassword(bootstrap.password);

    try {
        await prisma.user.create({
            data: {
                email: bootstrap.email,
                name: bootstrap.name ?? null,
                passwordHash,
                role: "admin",
                organizationId: organization.id,
            },
        });

        logger.info("Agency admin bootstrap user created on login", {
            endpoint: options.endpoint,
            orgSlug: organization.slug,
            email: bootstrap.email,
        });
    } catch (error) {
        const code =
            typeof error === "object" && error !== null && "code" in error
                ? String((error as { code?: unknown }).code ?? "")
                : "";

        if (code !== "P2002") {
            throw error;
        }
    }
}

export async function loginWithPassword(
    request: Request,
    options: LoginOptions,
): Promise<NextResponse> {
    try {
        let body: { email?: string; password?: string };
        try {
            body = (await request.json()) as { email?: string; password?: string };
        } catch {
            const rateLimit = await consumeAuthLoginRateLimit({
                request,
                endpoint: options.endpoint,
                identifier: "invalid_payload",
            });

            if (!rateLimit.allowed) {
                return rateLimitedResponse(request, options, rateLimit);
            }

            return apiError(request, {
                message: "INVALID_PAYLOAD",
                code: "BAD_REQUEST",
            }, { status: 400 });
        }

        const email = body.email?.toLowerCase().trim() ?? "";
        const password = body.password ?? "";

        if (!email || !password) {
            const rateLimit = await consumeAuthLoginRateLimit({
                request,
                endpoint: options.endpoint,
                identifier: "invalid_payload",
            });

            if (!rateLimit.allowed) {
                return rateLimitedResponse(request, options, rateLimit);
            }

            return apiError(request, {
                message: "EMAIL_AND_PASSWORD_REQUIRED",
                code: "BAD_REQUEST",
            }, { status: 400 });
        }

        const rateLimit = await consumeAuthLoginRateLimit({
            request,
            endpoint: options.endpoint,
            identifier: email,
        });

        if (!rateLimit.allowed) {
            return rateLimitedResponse(request, options, rateLimit);
        }

        await ensureAgencyAdminBootstrap(email, options);

        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                name: true,
                passwordHash: true,
                role: true,
                active: true,
                organizationId: true,
                lastAccessAt: true,
                organization: {
                    select: {
                        slug: true,
                    },
                },
            },
        });

        if (!user) {
            logger.warn("Login attempt for unknown email", { email, endpoint: options.endpoint });
            await trackEvent({ type: "LOGIN_FAILED", metadata: { email, reason: "unknown_email", endpoint: options.endpoint } });
            return unauthorizedResponse(request);
        }

        const role = normalizeSessionRole(String(user.role));
        if (!role) {
            logger.error("Login blocked: invalid role in database", {
                userId: user.id,
                role: user.role,
                endpoint: options.endpoint,
            });
            return apiError(request, {
                message: "INVALID_USER_ROLE",
                code: "INTERNAL_ERROR",
                details: { role: user.role },
            }, { status: 500 });
        }

        if (!user.active) {
            logger.warn("Login forbidden: inactive user", { email, userId: user.id, endpoint: options.endpoint });
            await trackEvent({ type: "LOGIN_FAILED", userId: user.id, organizationId: user.organizationId, metadata: { email, reason: "inactive_user", endpoint: options.endpoint } });
            return apiError(request, {
                message: "INACTIVE_USER",
                code: "FORBIDDEN",
            }, { status: 403 });
        }

        const validPassword = await verifyPassword(password, user.passwordHash);
        if (!validPassword) {
            logger.warn("Login failed: bad password", { email, userId: user.id, endpoint: options.endpoint });
            await trackEvent({ type: "LOGIN_FAILED", userId: user.id, organizationId: user.organizationId, metadata: { email, reason: "bad_password", endpoint: options.endpoint } });
            return unauthorizedResponse(request);
        }

        if (options.requireScope === "agency" && !isAgencyOrganization(user.organization.slug)) {
            logger.warn("Login forbidden: non-agency user on agency endpoint", {
                userId: user.id,
                orgSlug: user.organization.slug,
                endpoint: options.endpoint,
            });
            await trackEvent({ type: "LOGIN_FAILED", userId: user.id, organizationId: user.organizationId, metadata: { email, reason: "wrong_scope", endpoint: options.endpoint } });
            return apiError(request, {
                message: "FORBIDDEN",
                code: "FORBIDDEN",
            }, { status: 403 });
        }

        try {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    lastAccessAt: new Date(),
                },
            });
        } catch (error) {
            logger.warn("Login lastAccessAt update failed; continuing", {
                operation: "auth_login_last_access_update",
                result: "ignored",
                endpoint: options.endpoint,
                userId: user.id,
                organizationId: user.organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
        }

        const sessionPayload: SessionPayload = {
            userId: user.id,
            orgId: user.organizationId,
            orgSlug: user.organization.slug,
            role,
        };

        await setSessionCookie(sessionPayload);
        const authContext = resolveAuthContext(sessionPayload);
        const authScope = authContext.authScope ?? "tenant";

        logger.info("Login successful", {
            userId: user.id,
            orgSlug: user.organization.slug,
            role,
            authScope,
            endpoint: options.endpoint,
        });

        await trackEvent({
            type: "LOGIN_SUCCESS",
            userId: user.id,
            organizationId: user.organizationId,
            metadata: { email, role, endpoint: options.endpoint, authScope },
        });

        return NextResponse.json({
            success: true,
            orgSlug: user.organization.slug,
            role,
            authScope,
        });
    } catch (error) {
        if (isDatabaseUnavailableError(error)) {
            logger.error("Login database unavailable", {
                endpoint: options.endpoint,
                error: error instanceof Error ? error.message : String(error),
            });
            return apiError(request, {
                message: "DATABASE_UNAVAILABLE",
                code: "SERVICE_UNAVAILABLE",
            }, { status: 503 });
        }

        logger.error("Login error", { error: String(error), endpoint: options.endpoint });
        return apiError(request, {
            message: "INTERNAL_ERROR",
            code: "INTERNAL_ERROR",
        }, { status: 500 });
    }
}
