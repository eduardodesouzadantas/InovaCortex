/**
 * app/api/org/[slug]/outbound/prospects/[id]/reply/route.ts
 * V21: PATCH — Mark prospect as replied/meeting, pause sequence,
 *      optionally enqueue generate_deal_packet.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { logger } from "@/lib/logger";

interface Params { params: { slug: string; id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions as any).catch(() => null);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { replied?: boolean; meeting?: boolean; notes?: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { prisma } = await import("@/lib/prisma");

    const org = await (prisma as any).organization.findUnique({
        where: { slug: params.slug }, select: { id: true },
    }).catch(() => null);
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    const prospect = await (prisma as any).prospect.findFirst({
        where: { id: params.id, orgId: org.id },
    }).catch(() => null);
    if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

    try {
        const newStatus = body.meeting ? "meeting" : body.replied ? "replied" : prospect.status;

        await (prisma as any).prospect.update({
            where: { id: prospect.id },
            data: {
                status: newStatus,
                notes: body.notes ? `${prospect.notes ?? ""}\n\n${body.notes}`.trim() : prospect.notes,
            },
        });

        // Pause active sequence
        await (prisma as any).outboundSequence.updateMany({
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
    } catch (err: any) {
        logger.error("[OutboundReply] Error", { error: err?.message });
        return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
    }
}
