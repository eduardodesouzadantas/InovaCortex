import { withApiLogging } from "@/lib/logger";
/**
 * app/api/org/[slug]/outbound/messages/[msgId]/route.ts
 * V21: PATCH — Mark OutboundMessage as sent (manual confirmation).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";

interface Params { params: Promise<{ slug: string; msgId: string }> }

async function PATCHHandler(req: NextRequest, { params }: Params) {
    const { slug, msgId } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) {
        return resolveTenantRouteError(ctx, "Failed to resolve outbound message context");
    }
    try {
        assertTenantRole(ctx.role, "closer");
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to authorize outbound message update");
    }

    let body: { status?: string };
    try { body = await req.json(); }
    catch { return invalidTenantInputResponse("Invalid JSON"); }

    if (!body.status || typeof body.status !== "string") {
        return invalidTenantInputResponse("status is required");
    }

    const { prisma } = await import("@/lib/prisma");
    const result = await prisma.outboundMessage.updateMany({
        where: { id: msgId, orgId: ctx.orgId },
        data: { status: body.status ?? "sent", sentAt: new Date() },
    });
    if (!result.count) {
        return tenantNotFoundResponse("Outbound message not found");
    }

    return NextResponse.json({ message: "Mensagem atualizada", status: body.status });
}

export const PATCH = withApiLogging("/api/org/[slug]/outbound/messages/[msgId]", "PATCH", PATCHHandler);
