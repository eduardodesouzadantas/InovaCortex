/**
 * app/api/admin/executive-pack/[id]/route.ts
 * V24: GET — retrieve a generated executive pack by slug/id.
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { id } = params;
    try {
        const { prisma } = await import("@/lib/prisma");
        const pack = await (prisma as any).execPack.findFirst({
            where: { OR: [{ id }, { publicSlug: id }] },
        });
        if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const payload = JSON.parse(pack.payloadJson);
        return NextResponse.json({ ok: true, pack: payload, meta: { status: pack.status, generatedAt: pack.generatedAt } });
    } catch (err: any) {
        logger.error("[ExecPack GET]", { id, err: err?.message });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
