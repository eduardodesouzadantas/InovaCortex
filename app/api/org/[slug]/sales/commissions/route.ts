import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionSummary } from "@/lib/sales/stats-engine";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";

async function GETHandler(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) return orgContextErrorResponse(ctx);

    const searchParams = new URL(req.url).searchParams;
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const pagination = parsePagination(searchParams, { defaultLimit: 25, maxLimit: 100 });
    const summary = await getCommissionSummary(ctx.orgId, month);
    return NextResponse.json({
        summary: summary.slice(pagination.skip, pagination.skip + pagination.limit),
        month,
        pagination: buildPaginationMeta({ ...pagination, total: summary.length }),
    });
}

// PATCH — mark payout as paid
async function PATCHHandler(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) return orgContextErrorResponse(ctx);
    const { payoutId } = await req.json();

    const payout = await (prisma as any).commissionPayout.update({
        where: { id: payoutId },
        data: { status: "paid", paidAt: new Date() },
        select: {
            id: true,
            salesRepId: true,
            status: true,
            paidAt: true,
            amountCents: true,
        },
    });
    return NextResponse.json({ payout });
}

export const GET = withApiLogging("/api/org/[slug]/sales/commissions", "GET", GETHandler);
export const PATCH = withApiLogging("/api/org/[slug]/sales/commissions", "PATCH", PATCHHandler);
