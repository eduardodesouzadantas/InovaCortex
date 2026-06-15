/**
 * lib/auth/session.ts
 * V9: JWT-based session management with bcrypt password hashing.
 *
 * Cookie: `session` (httpOnly, secure, SameSite=Strict)
 * Payload: { userId, orgId, orgSlug, role, iat, exp }
 */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { logWarn } from "@/lib/core/observability/logger";
import { allowInsecureSessionFallback, isProductionEnv } from "@/lib/env";

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const COOKIE_NAME = "session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds
const DEFAULT_AGENCY_ORG_SLUG = "inovacortex";
const FALLBACK_JWT_SECRET = "inovacortex-fallback-jwt-secret-not-for-production";

let jwtSecretWarningLogged = false;

function getJwtSecret(): Uint8Array {
    const key = process.env.APP_ENCRYPTION_KEY;
    const normalizedKey = typeof key === "string" ? key.trim() : "";

    if (normalizedKey) {
        return new TextEncoder().encode(normalizedKey);
    }

    if (allowInsecureSessionFallback()) {
        if (!jwtSecretWarningLogged) {
            jwtSecretWarningLogged = true;
            logWarn("env_warning_missing", {
                module: "auth-session",
                message: "[ENV WARNING] APP_ENCRYPTION_KEY not configured",
                key: "APP_ENCRYPTION_KEY",
                mode: "local_fallback",
            });
        }
        return new TextEncoder().encode(FALLBACK_JWT_SECRET);
    }

    if (isProductionEnv()) {
        throw new Error("APP_ENCRYPTION_KEY is required in production");
    }

    throw new Error("APP_ENCRYPTION_KEY is required. Set ALLOW_INSECURE_SESSION_FALLBACK=true only for local development.");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionPayload {
    userId: string;
    orgId: string;
    orgSlug: string;
    role: "owner" | "admin" | "closer" | "viewer";
}

export type AuthScope = "agency" | "tenant";

export interface AuthContext {
    isAuthenticated: boolean;
    authScope: AuthScope | null;
    organizationId: string | null;
    organizationSlug: string | null;
    userId: string | null;
    role: SessionPayload["role"] | null;
    session: SessionPayload | null;
}

function isTruthyFlag(value: string | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isAuthContextSplitEnabled(): boolean {
    return isTruthyFlag(process.env.FF_AUTH_CONTEXT_SPLIT);
}

export function getAgencyOrgSlug(): string {
    // Source of truth for agency identity: canonical internal organization slug.
    // Defaults to "inovacortex" and can be overridden via AGENCY_ORG_SLUG.
    const raw = process.env.AGENCY_ORG_SLUG?.trim().toLowerCase();
    return raw || DEFAULT_AGENCY_ORG_SLUG;
}

function resolveAuthScopeFromSession(session: SessionPayload): AuthScope {
    if (!isAuthContextSplitEnabled()) {
        return "tenant";
    }

    const orgSlug = session.orgSlug.trim().toLowerCase();
    return orgSlug === getAgencyOrgSlug() ? "agency" : "tenant";
}

export function resolveAuthContext(session: SessionPayload | null): AuthContext {
    if (!session) {
        return {
            isAuthenticated: false,
            authScope: null,
            organizationId: null,
            organizationSlug: null,
            userId: null,
            role: null,
            session: null,
        };
    }

    const authScope = resolveAuthScopeFromSession(session);

    return {
        isAuthenticated: true,
        authScope,
        organizationId: session.orgId,
        organizationSlug: session.orgSlug,
        userId: session.userId,
        role: session.role,
        session,
    };
}

// ─── Password Utilities ───────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}

// ─── JWT Session ──────────────────────────────────────────────────────────────

export async function createSessionToken(payload: SessionPayload): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_TTL}s`)
        .sign(getJwtSecret());
}

export async function decodeSessionToken(token: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecret());
        return payload as unknown as SessionPayload;
    } catch {
        return null;
    }
}

// ─── Cookie Helpers ───────────────────────────────────────────────────────────

/** Set the session cookie (server action / route handler) */
export async function setSessionCookie(payload: SessionPayload): Promise<void> {
    const token = await createSessionToken(payload);
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.FORCE_SECURE_COOKIES === "true",
        sameSite: "lax",
        maxAge: SESSION_TTL,
        path: "/",
    });
}

/** Clear the session cookie */
export async function clearSessionCookie(): Promise<void> {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

/** Read and verify session from cookies (server components) */
export async function getSession(): Promise<SessionPayload | null> {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return decodeSessionToken(token);
}

/** Read and verify session from a request object (middleware / route handlers) */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return decodeSessionToken(token);
}

export async function getAuthContext(): Promise<AuthContext> {
    return resolveAuthContext(await getSession());
}

export async function getAuthContextFromRequest(req: NextRequest): Promise<AuthContext> {
    return resolveAuthContext(await getSessionFromRequest(req));
}

// ─── Auth Guards ──────────────────────────────────────────────────────────────

/** Require authenticated session — throws redirect-friendly Error if not */
export async function requireSession(): Promise<SessionPayload> {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHENTICATED");
    return session;
}

/** Require session belongs to a specific org */
export async function requireOrgSession(orgSlug: string): Promise<SessionPayload> {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated || !auth.session) throw new Error("UNAUTHENTICATED");

    if (auth.authScope !== "tenant") throw new Error("FORBIDDEN");
    if (auth.organizationSlug !== orgSlug) throw new Error("FORBIDDEN");

    return auth.session;
}
