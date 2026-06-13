/**
 * app/api/org/[slug]/deals/[packetId]/route.ts
 * PATCH: DealPacket status mutations (won/lost/resend).
 */

import { requireOrgContext } from "@/lib/auth/org-context";
import {
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import { logger, withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

interface Params {
    params: Promise<{ slug: string; packetId: string }>;
}

async function PATCHHandler(req: NextRequest, { params }: Params) {
    const { slug, packetId } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) {
        return resolveTenantRouteError(ctx, "Failed to resolve tenant context");
    }

    let body: { action?: string };
    try {
        body = await req.json();
    } catch {
        return invalidTenantInputResponse("Invalid JSON");
    }

    const { action } = body;
    if (!action) {
        return invalidTenantInputResponse("action required");
    }

    const { prisma } = await import("@/lib/prisma");

    try {
        const packet = await prisma.dealPacket.findFirst({
            where: { id: packetId, orgId: ctx.orgId },
            select: { id: true, orgId: true, assessmentId: true, status: true },
        });

        if (!packet) {
            return tenantNotFoundResponse("Deal packet not found");
        }

        switch (action) {
            case "won": {
                await prisma.dealPacket.update({ where: { id: packet.id }, data: { status: "won" } });
                return NextResponse.json({ message: "Marcado como Won", status: "won" });
            }
            case "lost": {
                await prisma.dealPacket.update({ where: { id: packet.id }, data: { status: "lost" } });
                return NextResponse.json({ message: "Marcado como Lost", status: "lost" });
            }
            case "resend_whatsapp": {
                logger.info("[DealsAPI] resend_whatsapp requested", { packetId: packet.id });
                await prisma.dealSignal.create({
                    data: {
                        orgId: packet.orgId,
                        assessmentId: packet.assessmentId,
                        dealPacketId: packet.id,
                        type: "whatsapp_sent",
                        metadataJson: JSON.stringify({ manual: true }),
                    },
                });
                return NextResponse.json({ message: "WhatsApp enfileirado para reenvio", status: packet.status });
            }
            default:
                return invalidTenantInputResponse(`Unknown action: ${action}`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[DealsAPI] Mutation failed", { packetId, action, error: message });
        return resolveTenantRouteError(error, "Failed to mutate deal packet");
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/deals/[packetId]", "PATCH", PATCHHandler);
