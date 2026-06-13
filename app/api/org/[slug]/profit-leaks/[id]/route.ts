/**
 * app/api/org/[slug]/profit-leaks/[id]/route.ts
 * V22.3: PATCH - update a ProfitLeak status.
 *
 * Body: { status: "open" | "acknowledged" | "resolved" }
 *
 * Auth/RBAC:
 * - tenant session scoped to slug
 * - open/acknowledged: closer+
 * - resolved: admin+
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger, withApiLogging } from "@/lib/logger";
import { requireOrgContextFromRequest } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";

const ALLOWED_STATUSES = ["open", "acknowledged", "resolved"] as const;
type LeakStatus = typeof ALLOWED_STATUSES[number];

async function PATCHHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;

    let body: { status?: LeakStatus };
    try {
        body = await req.json();
    } catch {
        return invalidTenantInputResponse("Invalid JSON");
    }

    const newStatus = body.status;
    if (!newStatus || !ALLOWED_STATUSES.includes(newStatus)) {
        return invalidTenantInputResponse("Invalid status");
    }

    const requiredRole: "admin" | "closer" = newStatus === "resolved" ? "admin" : "closer";

    try {
        const ctx = await requireOrgContextFromRequest(req, slug);
        assertTenantRole(ctx.role, requiredRole);

        const updateResult = await prisma.profitLeak.updateMany({
            where: { id, orgId: ctx.orgId },
            data: { status: newStatus, updatedAt: new Date() },
        });

        if (!updateResult?.count) {
            return tenantNotFoundResponse("Profit leak not found");
        }

        const updated = await prisma.profitLeak.findFirst({
            where: { id, orgId: ctx.orgId },
        });

        await prisma.auditEvent.create({
            data: {
                assessmentId: "system",
                organizationId: ctx.orgId,
                action: "profitLeakStatusChanged",
                details: JSON.stringify({
                    leakId: id,
                    newStatus,
                    actorMode: "session",
                    actorRole: ctx.role,
                    actorUserId: ctx.userId,
                }),
            },
        }).catch(() => null);

        logger.info("[ProfitLeak PATCH]", {
            id,
            newStatus,
            actorMode: "session",
            orgId: ctx.orgId,
        });

        return NextResponse.json({ ok: true, leak: updated });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("[ProfitLeak PATCH]", { id, err: message });
        return resolveTenantRouteError(err, "Failed to update profit leak");
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/profit-leaks/[id]", "PATCH", PATCHHandler);
