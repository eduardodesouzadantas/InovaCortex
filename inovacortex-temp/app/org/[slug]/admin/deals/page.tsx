/**
 * app/org/[slug]/admin/deals/page.tsx
 * V21: Admin Deals Panel — DealPacket browser.
 *
 * Shows:
 *  - DealPackets list with tier badges, status, signal timeline
 *  - Filters: status / tier
 *  - Actions: view exec one-pager, mark won/lost, resend WhatsApp
 *  - DealSignal timeline per packet
 */

import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { DealsClient } from "./deals-client";

interface Props {
    params: { slug: string };
    searchParams: { status?: string; tier?: string };
}

async function getData(slug: string, filters: { status?: string; tier?: string }) {
    const { prisma } = await import("@/lib/prisma");

    const org = await (prisma as any).organization.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true },
    }).catch(() => null);
    if (!org) return null;

    const where: any = { orgId: org.id };
    if (filters.status) where.status = filters.status;
    if (filters.tier) where.tier = filters.tier;

    const packets = await (prisma as any).dealPacket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
            signals: {
                orderBy: { createdAt: "asc" },
                select: { id: true, type: true, createdAt: true, metadataJson: true },
            },
        },
    }).catch(() => []);

    return { org, packets };
}

export default async function DealsAdminPage({ params, searchParams }: Props) {
    const session = await getServerSession(authOptions as any).catch(() => null);
    if (!session) redirect("/admin/login");

    const data = await getData(params.slug, searchParams);
    if (!data) notFound();

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">🎯 Deal Flow</h1>
                    <p className="text-gray-400 mt-1">{data.org.name} · {data.packets.length} deals</p>
                </div>
                <DealsClient
                    orgSlug={params.slug}
                    packets={data.packets}
                    activeFilters={searchParams}
                />
            </div>
        </div>
    );
}
