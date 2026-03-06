import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { StrategyClient } from "./_components/strategy-client";

export default async function StrategyPage({ params }: { params: { slug: string } }) {
    const { slug } = await params;

    const org = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true, name: true, industry: true }
    });

    if (!org) return <div>Organization not found</div>;

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-white">
            <Suspense fallback={<div className="p-12 animate-pulse text-zinc-500">Carregando Inteligência Estratégica...</div>}>
                <StrategyClient
                    orgId={org.id}
                    orgSlug={slug}
                    orgName={org.name}
                    industry={org.industry}
                />
            </Suspense>
        </div>
    );
}
