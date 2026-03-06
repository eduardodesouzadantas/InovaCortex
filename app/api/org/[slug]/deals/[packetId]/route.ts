/**
 * app/api/org/[slug]/deals/[packetId]/route.ts
 * V21: PATCH — DealPacket status mutations (won/lost/resend).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { logger } from "@/lib/logger";

interface Params { params: Promise<{ slug: string; packetId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
    const { slug, packetId } = await params;
    let ctx;
    try { ctx = await requireOrgContext(slug); }
    catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

    let body: { action: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { action } = body;
    if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });

    const { prisma } = await import("@/lib/prisma");

    const packet = await (prisma as any).dealPacket.findUnique({
        where: { id: packetId },
        select: { id: true, orgId: true, assessmentId: true, execSlug: true, status: true },
    }).catch(() => null);

    if (!packet) return NextResponse.json({ error: "DealPacket not found" }, { status: 404 });

    if (ctx.orgId !== packet.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        switch (action) {
            case "won": {
                await (prisma as any).dealPacket.update({ where: { id: packet.id }, data: { status: "won" } });
                return NextResponse.json({ message: "Marcado como Won 🏆", status: "won" });
            }
            case "lost": {
                await (prisma as any).dealPacket.update({ where: { id: packet.id }, data: { status: "lost" } });
                return NextResponse.json({ message: "Marcado como Lost", status: "lost" });
            }
            case "resend_whatsapp": {
                logger.info("[DealsAPI] resend_whatsapp requested", { packetId: packet.id });
                // Record signal + queue action
                await (prisma as any).dealSignal.create({
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
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (err: any) {
        logger.error("[DealsAPI] Mutation failed", { packetId: packet.id, action, error: err?.message });
        return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
    }
}
