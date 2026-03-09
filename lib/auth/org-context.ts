/**
 * lib/auth/org-context.ts
 * V9: Organization context — data isolation enforcement.
 *
 * Every page and API route that touches tenant data must call
 * requireOrgContext() first. This ensures organizationId is injected
 * into all queries and cross-org access is impossible.
 */

import { prisma } from "@/lib/prisma";
import { resolveAuthContext, getAuthContext, type SessionPayload } from "@/lib/auth/session";

export interface OrgContext {
    orgId: string;
    orgSlug: string;
    userId: string;
    role: string;
    plan: string;
    maxAssessmentsPerMonth: number;
}

/**
 * Server-side: verify session, look up org by slug, ensure user belongs to it.
 * Returns OrgContext or throws "UNAUTHENTICATED" / "FORBIDDEN".
 */
export async function requireOrgContext(orgSlug: string): Promise<OrgContext> {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated || !auth.session) throw new Error("UNAUTHENTICATED");
    if (auth.authScope !== "tenant") throw new Error("FORBIDDEN");
    if (auth.organizationSlug !== orgSlug) throw new Error("FORBIDDEN");
    if (!auth.organizationId || !auth.userId || !auth.role) throw new Error("FORBIDDEN");

    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug }
    });
    if (!org) throw new Error("ORG_NOT_FOUND");
    if (org.id !== auth.organizationId) throw new Error("FORBIDDEN");

    return {
        orgId: org.id,
        orgSlug: org.slug,
        userId: auth.userId,
        role: auth.role,
        plan: org.plan,
        maxAssessmentsPerMonth: org.maxAssessmentsPerMonth,
    };
}

/**
 * Get org context for a request coming from a session cookie without slug check.
 * Used in API routes where slug is not in the URL.
 */
export async function getOrgContextFromSession(session: SessionPayload): Promise<OrgContext> {
    const auth = resolveAuthContext(session);
    if (!auth.isAuthenticated || !auth.session) throw new Error("UNAUTHENTICATED");
    if (auth.authScope !== "tenant") throw new Error("FORBIDDEN");
    if (!auth.organizationId || !auth.userId || !auth.role) throw new Error("FORBIDDEN");

    const org = await prisma.organization.findUnique({
        where: { id: auth.organizationId }
    });
    if (!org) throw new Error("ORG_NOT_FOUND");

    return {
        orgId: org.id,
        orgSlug: org.slug,
        userId: auth.userId,
        role: auth.role,
        plan: org.plan,
        maxAssessmentsPerMonth: org.maxAssessmentsPerMonth,
    };
}

/**
 * For public pages (dossier, proposal) — just looks up the org by slug without auth.
 * Used to brand the page.
 */
export async function getPublicOrgBySlug(orgSlug: string) {
    return prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true, name: true, slug: true }
    });
}
