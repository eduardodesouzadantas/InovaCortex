import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { getCommissionSummary } from "@/lib/sales/stats-engine";

const getOrg = async (slug: string) =>
    prisma.organization.findUnique({ where: { slug }, select: { id: true } });

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const session = await getSession();
    if (!session || session.orgSlug !== (await params).slug) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const org = await getOrg((await params).slug);
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const month = new URL(req.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const summary = await getCommissionSummary(org.id, month);
    return NextResponse.json({ summary, month });
}

// PATCH — mark payout as paid
export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const session = await getSession();
    if (!session || session.orgSlug !== (await params).slug) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const { payoutId } = await req.json();

    const payout = await (prisma as any).commissionPayout.update({
        where: { id: payoutId },
        data: { status: "paid", paidAt: new Date() }
    });
    return NextResponse.json({ payout });
}
