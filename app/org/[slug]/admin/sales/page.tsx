import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import { SalesDashboardClient } from "./sales-dashboard-client";

interface PageProps {
    params: {
        slug: string;
    };
}

/**
 * app/org/[slug]/admin/sales/page.tsx — V35
 * Premium Sales Operations Dashboard.
 */
export default async function SalesPage({ params }: PageProps) {
    const session = await getSession();
    if (!session || session.orgSlug !== params.slug) {
        redirect(`/org/${params.slug}/admin/login`);
    }

    const org = await prisma.organization.findUnique({
        where: { slug: params.slug },
        select: { id: true, name: true, slug: true },
    });

    if (!org) notFound();

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 pb-20">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gold-400 font-medium">
                            <span className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
                            Sales Team OS
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-white/40 bg-clip-text text-transparent">
                            Mission Control: Revenue Ops
                        </h1>
                        <p className="text-gray-400 max-w-2xl">
                            Gestão de closers, SDRs, metas de faturamento e performance de pipeline em tempo real para <span className="text-white font-medium">{org.name}</span>.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="h-10 px-4 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 text-sm text-gray-400">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            Live Sync Ativo
                        </div>
                    </div>
                </header>

                <Suspense fallback={
                    <div className="w-full h-[600px] rounded-2xl bg-white/5 border border-white/10 animate-pulse flex items-center justify-center">
                        <div className="text-gray-500 font-medium uppercase tracking-widest">Iniciando Sistemas de Vendas...</div>
                    </div>
                }>
                    <SalesDashboardClient orgSlug={params.slug} />
                </Suspense>
            </div>
        </div>
    );
}
