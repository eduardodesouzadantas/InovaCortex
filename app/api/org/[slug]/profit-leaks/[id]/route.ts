/**
 * app/api/org/[slug]/profit-leaks/[id]/route.ts
 * V22.3: PATCH - update a ProfitLeak status.
 *
 * Body: { status: "open" | "acknowledged" | "resolved" }
 *
 * Auth/RBAC:
 * - Primary: tenant session scoped to slug
 * - open/acknowledged: closer+
 * - resolved: admin+
 * - Legacy fallback: x-admin-token only when FF_ENABLE_LEGACY_HEADER_ADMIN_AUTH=true
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAuthContextFromRequest } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { requireOrgContext } from "@/lib/auth/org-context";

const ALLOWED_STATUSES = ["open", "acknowledged", "resolved"] as const;
type LeakStatus = typeof ALLOWED_STATUSES[number];

function isTruthyFlag(value: string | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isLegacyHeaderAdminAuthEnabled(): boolean {
    return isTruthyFlag(process.env.FF_ENABLE_LEGACY_HEADER_ADMIN_AUTH);
}

function hasValidLegacyAdminToken(req: NextRequest): boolean {
    const expected = process.env.ADMIN_SECRET_TOKEN;
    const provided = req.headers.get("x-admin-token");
    return !!expected && !!provided && provided === expected;
}

function mapOrgContextError(err: unknown): { status: 401 | 403 | 404; error: string } {
    if (err instanceof Error) {
        if (err.message === "UNAUTHENTICATED") return { status: 401, error: "Unauthorized" };
        if (err.message === "ORG_NOT_FOUND") return { status: 404, error: "Not found" };
    }
    return { status: 403, error: "Forbidden" };
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;

    let body: { status?: LeakStatus };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const newStatus = body.status;
    if (!newStatus || !ALLOWED_STATUSES.includes(newStatus)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const requiredRole: "admin" | "closer" = newStatus === "resolved" ? "admin" : "closer";

    const org = await (prisma as any).organization.findUnique({
        where: { slug },
        select: { id: true },
    }).catch(() => null);
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const auth = await getAuthContextFromRequest(req);
    let actor: { mode: "session" | "legacy_header"; role: string; userId: string | null } | null = null;

    if (auth.isAuthenticated) {
        try {
            const ctx = await requireOrgContext(slug);
            if (!hasRole(ctx.role, requiredRole)) {
                return NextResponse.json({ error: `${requiredRole} role required` }, { status: 403 });
            }
            actor = { mode: "session", role: ctx.role, userId: ctx.userId };
        } catch (err) {
            const mapped = mapOrgContextError(err);
            return NextResponse.json({ error: mapped.error }, { status: mapped.status });
        }
    } else if (isLegacyHeaderAdminAuthEnabled() && hasValidLegacyAdminToken(req)) {
        if (!hasRole("admin", requiredRole)) {
            return NextResponse.json({ error: `${requiredRole} role required` }, { status: 403 });
        }
        actor = { mode: "legacy_header", role: "admin", userId: null };
    } else {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const updateResult = await (prisma as any).profitLeak.updateMany({
            where: { id, orgId: org.id },
            data: { status: newStatus, updatedAt: new Date() },
        });

        if (!updateResult?.count) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const updated = await (prisma as any).profitLeak.findFirst({
            where: { id, orgId: org.id },
        });

        await (prisma as any).auditEvent.create({
            data: {
                assessmentId: "system",
                organizationId: org.id,
                action: "profitLeakStatusChanged",
                details: JSON.stringify({
                    leakId: id,
                    newStatus,
                    actorMode: actor?.mode,
                    actorRole: actor?.role,
                    actorUserId: actor?.userId,
                }),
            },
        }).catch(() => null);

        logger.info("[ProfitLeak PATCH]", {
            id,
            newStatus,
            actorMode: actor?.mode,
            orgId: org.id,
        });

        return NextResponse.json({ ok: true, leak: updated });
    } catch (err: any) {
        logger.error("[ProfitLeak PATCH]", { id, err: err?.message });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
