/**
 * lib/auth/session.ts
 * V9: JWT-based session management with bcrypt password hashing.
 *
 * Cookie: `session` (httpOnly, secure, SameSite=Strict)
 * Payload: { userId, orgId, orgSlug, role, iat, exp }
 */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const COOKIE_NAME = "session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

function getJwtSecret(): Uint8Array {
    const key = process.env.APP_ENCRYPTION_KEY ?? "inovacortex-dev-secret-please-change-this-in-prod";
    return new TextEncoder().encode(key);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionPayload {
    userId: string;
    orgId: string;
    orgSlug: string;
    role: "owner" | "admin" | "closer" | "viewer";
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
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: SESSION_TTL,
        path: "/",
    });
}

/** Clear the session cookie */
export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

/** Read and verify session from cookies (server components) */
export async function getSession(): Promise<SessionPayload | null> {
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

// ─── Auth Guards ──────────────────────────────────────────────────────────────

/** Require authenticated session — throws redirect-friendly Error if not */
export async function requireSession(): Promise<SessionPayload> {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHENTICATED");
    return session;
}

/** Require session belongs to a specific org */
export async function requireOrgSession(orgSlug: string): Promise<SessionPayload> {
    const session = await requireSession();
    if (session.orgSlug !== orgSlug) throw new Error("FORBIDDEN");
    return session;
}
