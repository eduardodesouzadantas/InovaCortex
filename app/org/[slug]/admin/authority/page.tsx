/**
 * app/org/[slug]/admin/authority/page.tsx
 * V21: Authority Library Admin — Proof Assets browser.
 *
 * Shows:
 *  - ProofStatSnapshot panel at top (copy buttons)
 *  - ProofAsset list with status filter (draft/reviewed/approved/published)
 *  - Per-asset: markdown viewer, type badge, review/approve/publish buttons
 */

import { notFound, redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { AuthorityLibraryClient } from "./authority-library-client";

interface Props {
    params: { slug: string };
    searchParams: { status?: string; type?: string };
}

async function getData(slug: string, filters: { status?: string; type?: string }) {
    const { prisma } = await import("@/lib/prisma");

    const org = await (prisma as any).organization.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true },
    }).catch(() => null);

    if (!org) return null;

    const where: any = { orgId: org.id };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;

    const [assets, stats] = await Promise.all([
        (prisma as any).proofAsset.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 50,
        }).catch(() => []),
        (prisma as any).proofStatSnapshot.findUnique({
            where: { orgId: org.id },
        }).catch(() => null),
    ]);

    return { org, assets, stats };
}

export default async function AuthorityAdminPage({ params, searchParams }: Props) {
    let ctx;
    try { ctx = await requireOrgContext(params.slug); }
    catch { redirect("/admin/login"); }

    const data = await getData(params.slug, searchParams);
    if (!data) notFound();

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">🏆 Biblioteca de Autoridade</h1>
                    <p className="text-gray-400 mt-1">{data.org.name} · {data.assets.length} ativos</p>
                </div>

                <AuthorityLibraryClient
                    orgSlug={params.slug}
                    orgId={data.org.id}
                    assets={data.assets}
                    stats={data.stats}
                    activeFilters={searchParams}
                />
            </div>
        </div>
    );
}
