import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { alertDailySummary } from "@/lib/ai/whatsapp-alerts";
import { runAlertEngine } from "@/lib/whatsapp/alert-engine";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/cron/whatsapp-briefing
 * Triggered daily (e.g., via Vercel Cron at 8am).
 * Sends morning briefing + scans all active alerts.
 * Auth: x-cron-secret header
 */
export async function POST(request: Request) {
    const secret = request.headers.get("x-cron-secret");
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgSlug = process.env.WHATSAPP_COPILOT_ORG_SLUG;
    if (!orgSlug) {
        return NextResponse.json({ error: "WHATSAPP_COPILOT_ORG_SLUG not set" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true, name: true }
    });

    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    try {
        // Daily briefing + all alert scans run in parallel
        await Promise.allSettled([
            alertDailySummary(org.id),
            runAlertEngine(org.id)
        ]);

        logger.info(`Cron: briefing + alerts complete for org: ${org.name}`);
        return NextResponse.json({ success: true, org: org.name });
    } catch (error: any) {
        logger.error(`Cron failed: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
