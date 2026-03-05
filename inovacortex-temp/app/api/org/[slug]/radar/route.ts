/**
 * app/api/org/[slug]/radar/route.ts
 * V23: GET radar payload for an org.
 *
 * Cache: 5s server-side (Cache-Control header)
 * Auth:  org member (any session) — public within org
 */

import { NextRequest, NextResponse } from "next/server";
import { loadRadar } from "@/lib/radar/radar-loader";
import { logger } from "@/lib/logger";

export const revalidate = 5; // Next.js route segment cache 5s

export async function GET(
    _req: NextRequest,
    { params }: { params: { slug: string } },
) {
    const { slug } = params;

    try {
        const { prisma } = await import("@/lib/prisma");
        const org = await (prisma as any).organization.findUnique({
            where: { slug },
            select: { id: true },
        });
        if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const payload = await loadRadar(org.id);

        return NextResponse.json(payload, {
            headers: {
                "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
            },
        });

    } catch (err: any) {
        logger.error("[RadarAPI]", { slug, err: err?.message });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
