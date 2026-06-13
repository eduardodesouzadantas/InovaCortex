import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { scanSLABreaches, groupBreachesByRep } from "@/lib/sales/sla-engine";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";

async function GETHandler(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) return orgContextErrorResponse(ctx);

    const { searchParams } = new URL(req.url);
    const hours = parseInt(searchParams.get("hours") || "48");

    const breaches = await scanSLABreaches(ctx.orgId, hours);
    const byRep = groupBreachesByRep(breaches);
    return NextResponse.json({ breaches, byRep, total: breaches.length });
}

export const GET = withApiLogging("/api/org/[slug]/sales/sla", "GET", GETHandler);
