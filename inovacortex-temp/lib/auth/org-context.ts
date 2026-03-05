/**
 * lib/auth/org-context.ts
 * V9: Organization context — data isolation enforcement.
 *
 * Every page and API route that touches tenant data must call
 * requireOrgContext() first. This ensures organizationId is injected
 * into all queries and cross-org access is impossible.
 */

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { SessionPayload } from "@/lib/auth/session";

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
    const session = await getSession();
    if (!session) throw new Error("UNAUTHENTICATED");
    if (session.orgSlug !== orgSlug) throw new Error("FORBIDDEN");

    const org = await (prisma as any).organization.findUnique({
        where: { slug: orgSlug }
    });
    if (!org) throw new Error("ORG_NOT_FOUND");
    if (org.id !== session.orgId) throw new Error("FORBIDDEN");

    return {
        orgId: org.id,
        orgSlug: org.slug,
        userId: session.userId,
        role: session.role,
        plan: org.plan,
        maxAssessmentsPerMonth: org.maxAssessmentsPerMonth,
    };
}

/**
 * Get org context for a request coming from a session cookie without slug check.
 * Used in API routes where slug is not in the URL.
 */
export async function getOrgContextFromSession(session: SessionPayload): Promise<OrgContext> {
    const org = await (prisma as any).organization.findUnique({
        where: { id: session.orgId }
    });
    if (!org) throw new Error("ORG_NOT_FOUND");

    return {
        orgId: org.id,
        orgSlug: org.slug,
        userId: session.userId,
        role: session.role,
        plan: org.plan,
        maxAssessmentsPerMonth: org.maxAssessmentsPerMonth,
    };
}

/**
 * For public pages (dossier, proposal) — just looks up the org by slug without auth.
 * Used to brand the page.
 */
export async function getPublicOrgBySlug(orgSlug: string) {
    return (prisma as any).organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true, name: true, slug: true }
    });
}
