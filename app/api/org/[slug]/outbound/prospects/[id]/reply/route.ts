/**
 * app/api/org/[slug]/outbound/prospects/[id]/reply/route.ts
 * V21: PATCH — Mark prospect as replied/meeting, pause sequence,
 *      optionally enqueue generate_deal_packet.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import { logger, withApiLogging } from "@/lib/logger";

interface Params { params: Promise<{ slug: string; id: string }> }

async function PATCHHandler(req: NextRequest, { params }: Params) {
    const { slug, id } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) {
        return resolveTenantRouteError(ctx, "Failed to resolve outbound prospect context");
    }
    try {
        assertTenantRole(ctx.role, "closer");
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to authorize outbound prospect update");
    }

    let body: { replied?: boolean; meeting?: boolean; notes?: string };
    try { body = await req.json(); }
    catch { return invalidTenantInputResponse("Invalid JSON"); }

    const { prisma } = await import("@/lib/prisma");

    const prospect = await prisma.prospect.findFirst({
        where: { id, orgId: ctx.orgId },
    });
    if (!prospect) return tenantNotFoundResponse("Prospect not found");

    try {
        const newStatus = body.meeting ? "meeting" : body.replied ? "replied" : prospect.status;

        await prisma.prospect.update({
            where: { id: prospect.id },
            data: {
                status: newStatus,
                notes: body.notes ? `${prospect.notes ?? ""}\n\n${body.notes}`.trim() : prospect.notes,
            },
        });

        // Pause active sequence
        await prisma.outboundSequence.updateMany({
            where: { prospectId: prospect.id, paused: false },
            data: { paused: true, lastResult: "replied" },
        }).catch(() => null);

        logger.info("[OutboundReply] Prospect updated", {
            prospectId: prospect.id, newStatus, meeting: body.meeting,
        });

        return NextResponse.json({
            message: body.meeting ? "Reunião registrada! Sequência pausada. 🎉" : "Resposta registrada. Sequência pausada.",
            status: newStatus,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("[OutboundReply] Error", { error: message });
        return resolveTenantRouteError(err, "Failed to update outbound prospect");
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/outbound/prospects/[id]/reply", "PATCH", PATCHHandler);
