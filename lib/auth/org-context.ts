/**
 * lib/auth/org-context.ts
 * V9: Organization context — data isolation enforcement.
 *
 * Every page and API route that touches tenant data must call
 * requireOrgContext() first. This ensures organizationId is injected
 * into all queries and cross-org access is impossible.
 */

import { prisma } from "@/lib/prisma";
import { getAuthContext, getAuthContextFromRequest, resolveAuthContext, type AuthContext, type SessionPayload } from "@/lib/auth/session";
import { tenantContextErrorResponse } from "@/lib/auth/tenant-route";
import { setRequestContext } from "@/lib/observability/request-context";
import { NextRequest, NextResponse } from "next/server";
import { normalizeOrganizationAccountStatus, type OrganizationAccountStatus } from "@/lib/billing/account-status";

export interface OrgContext {
    orgId: string;
    orgSlug: string;
    userId: string;
    role: string;
    plan: string;
    maxAssessmentsPerMonth: number;
    subscriptionStatus: OrganizationAccountStatus;
}

export function orgContextErrorResponse(error: unknown) {
    return tenantContextErrorResponse(error)
        ?? NextResponse.json({ success: false, error: "FORBIDDEN", message: "Access denied" }, { status: 403 });
}

async function findOrgBySlug(orgSlug: string) {
    return prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: {
            id: true,
            slug: true,
            plan: true,
            maxAssessmentsPerMonth: true,
            subscriptionStatus: true,
        },
    });
}

async function ensureTenantUserIsActive(userId: string, organizationId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            active: true,
            organizationId: true,
        },
    });

    if (!user || user.organizationId !== organizationId || !user.active) {
        throw new Error("FORBIDDEN");
    }
}

export async function requireOrgAccess(userId: string, orgSlug: string) {
    const org = await findOrgBySlug(orgSlug);
    if (!org) throw new Error("ORG_NOT_FOUND");

    const membership = await prisma.agencyMembership.findFirst({
        where: {
            userId,
            active: true,
        },
        select: {
            id: true,
        },
    });

    if (!membership) {
        throw new Error("FORBIDDEN");
    }

    const access = await prisma.organizationAccess.findFirst({
        where: {
            agencyMembershipId: membership.id,
            organizationId: org.id,
            active: true,
        },
        select: {
            id: true,
        },
    });

    if (!access) {
        throw new Error("FORBIDDEN");
    }

    return org;
}

async function resolveOrgContextForAuth(
    orgSlug: string,
    auth: AuthContext,
): Promise<OrgContext> {
    if (!auth.isAuthenticated || !auth.session) throw new Error("UNAUTHENTICATED");
    if (!auth.organizationId || !auth.userId || !auth.role) throw new Error("FORBIDDEN");

    if (auth.authScope === "agency") {
        return resolveOrgContextFromAgencySession(orgSlug, auth);
    }

    if (auth.authScope !== "tenant") throw new Error("FORBIDDEN");
    if (auth.organizationSlug !== orgSlug) throw new Error("FORBIDDEN");

    const org = await findOrgBySlug(orgSlug);
    if (!org) throw new Error("ORG_NOT_FOUND");
    if (org.id !== auth.organizationId) throw new Error("FORBIDDEN");
    await ensureTenantUserIsActive(auth.userId, auth.organizationId);

    const context = {
        orgId: org.id,
        orgSlug: org.slug,
        userId: auth.userId,
        role: auth.role,
        plan: org.plan,
        maxAssessmentsPerMonth: org.maxAssessmentsPerMonth,
        subscriptionStatus: normalizeOrganizationAccountStatus(org.subscriptionStatus),
    };

    setRequestContext({
        organizationId: context.orgId,
        organizationSlug: context.orgSlug,
        userId: context.userId,
        operation: "resolve_org_context",
    });

    return context;
}

export async function resolveOrgContextFromAgencySession(
    orgSlug: string,
    authInput?: AuthContext,
): Promise<OrgContext> {
    const auth = authInput ?? await getAuthContext();
    if (!auth.isAuthenticated || !auth.session) throw new Error("UNAUTHENTICATED");
    if (auth.authScope !== "agency") throw new Error("FORBIDDEN");
    if (!auth.userId || !auth.role) throw new Error("FORBIDDEN");

    const org = await requireOrgAccess(auth.userId, orgSlug);

    const context = {
        orgId: org.id,
        orgSlug: org.slug,
        userId: auth.userId,
        role: auth.role,
        plan: org.plan,
        maxAssessmentsPerMonth: org.maxAssessmentsPerMonth,
        subscriptionStatus: normalizeOrganizationAccountStatus(org.subscriptionStatus),
    };

    setRequestContext({
        organizationId: context.orgId,
        organizationSlug: context.orgSlug,
        userId: context.userId,
        operation: "resolve_org_context",
    });

    return context;
}

/**
 * Server-side: verify session, look up org by slug, ensure user belongs to it.
 * Returns OrgContext or throws "UNAUTHENTICATED" / "FORBIDDEN".
 */
export async function requireOrgContext(orgSlug: string): Promise<OrgContext> {
    const auth = await getAuthContext();
    const context = await resolveOrgContextForAuth(orgSlug, auth);
    setRequestContext({
        organizationId: context.orgId,
        organizationSlug: context.orgSlug,
        userId: context.userId,
        operation: "resolve_org_context",
    });
    return context;
}

export async function requireOrgContextFromRequest(request: NextRequest, orgSlug: string): Promise<OrgContext> {
    const auth = await getAuthContextFromRequest(request);
    const context = await resolveOrgContextForAuth(orgSlug, auth);
    setRequestContext({
        organizationId: context.orgId,
        organizationSlug: context.orgSlug,
        userId: context.userId,
        operation: "resolve_org_context",
    });
    return context;
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
    await ensureTenantUserIsActive(auth.userId, auth.organizationId);

    const context = {
        orgId: org.id,
        orgSlug: org.slug,
        userId: auth.userId,
        role: auth.role,
        plan: org.plan,
        maxAssessmentsPerMonth: org.maxAssessmentsPerMonth,
        subscriptionStatus: normalizeOrganizationAccountStatus(org.subscriptionStatus),
    };

    setRequestContext({
        organizationId: context.orgId,
        organizationSlug: context.orgSlug,
        userId: context.userId,
        operation: "resolve_org_context",
    });

    return context;
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
