import { NextResponse } from "next/server";
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

function unauthorizedResponse() {
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
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
        // Ignore unique race condition if another request created the same user concurrently.
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
            return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 });
        }

        await ensureAgencyAdminBootstrap(email, options);

        const user = await prisma.user.findUnique({
            where: { email },
            include: { organization: { select: { id: true, slug: true } } },
        });

        if (!user) {
            logger.warn("Login attempt for unknown email", { email, endpoint: options.endpoint });
            return unauthorizedResponse();
        }

        const role = normalizeSessionRole(String(user.role));
        if (!role) {
            logger.error("Login blocked: invalid role in database", {
                userId: user.id,
                role: user.role,
                endpoint: options.endpoint,
            });
            return NextResponse.json({ error: "ERRO_ROLE_INVALIDA: " + user.role }, { status: 500 });
        }

        const validPassword = await verifyPassword(password, user.passwordHash);
        if (!validPassword) {
            logger.warn("Login failed: bad password", { email, userId: user.id, endpoint: options.endpoint });
            return unauthorizedResponse();
        }

        if (options.requireScope === "agency" && !isAgencyOrganization(user.organization.slug)) {
            logger.warn("Login forbidden: non-agency user on agency endpoint", {
                userId: user.id,
                orgSlug: user.organization.slug,
                endpoint: options.endpoint,
            });
            return NextResponse.json({ error: "Acesso restrito ao contexto da agência" }, { status: 403 });
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
        logger.error("Login error", { error: String(error), endpoint: options.endpoint });
        return NextResponse.json({ error: "ERRO_REAL_DO_SISTEMA: " + String(error) }, { status: 500 });
    }
}
