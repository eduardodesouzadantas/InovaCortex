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
import { logger } from "@/lib/logger";
import { isDatabaseUnavailableError } from "@/lib/system/db-check";

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

function resolveAdminBootstrapCredentials(): AdminBootstrapCredentials | null {
    const email = (process.env.ADMIN_EMAIL ?? process.env.INITIAL_ADMIN_EMAIL ?? "").trim().toLowerCase();
    const password = (process.env.ADMIN_PASSWORD ?? process.env.INITIAL_ADMIN_PASSWORD ?? "").trim();

    if (!email || !password) {
        return null;
    }

    return { email, password };
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
): Promise<NextResponse<LoginSuccessPayload | { error: string }>> {
    try {
        const body = (await request.json()) as { email?: string; password?: string };
        const email = body.email?.toLowerCase().trim() ?? "";
        const password = body.password ?? "";

        if (!email || !password) {
            return apiError(request, {
                message: "EMAIL_AND_PASSWORD_REQUIRED",
                code: "BAD_REQUEST",
            }, { status: 400 });
        }

        await ensureAgencyAdminBootstrap(email, options);

        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                passwordHash: true,
                role: true,
                active: true,
                organizationId: true,
                organization: {
                    select: {
                        slug: true,
                    },
                },
            },
        });

        if (!user) {
            logger.warn("Login attempt for unknown email", { email, endpoint: options.endpoint });
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
            return unauthorizedResponse(request);
        }

        const validPassword = await verifyPassword(password, user.passwordHash);
        if (!validPassword) {
            logger.warn("Login failed: bad password", { email, userId: user.id, endpoint: options.endpoint });
            return unauthorizedResponse(request);
        }

        if (options.requireScope === "agency" && !isAgencyOrganization(user.organization.slug)) {
            logger.warn("Login forbidden: non-agency user on agency endpoint", {
                userId: user.id,
                orgSlug: user.organization.slug,
                endpoint: options.endpoint,
            });
            return apiError(request, {
                message: "FORBIDDEN",
                code: "FORBIDDEN",
            }, { status: 403 });
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
