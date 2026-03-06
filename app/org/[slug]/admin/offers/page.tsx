import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { OfferStudioClient } from "./_components/offer-studio-client";

export default async function OffersPage({ params }: { params: { slug: string } }) {
    const { slug } = await params;

    const org = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true, name: true }
    });

    if (!org) return <div>Organization not found</div>;

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-white">
            <Suspense fallback={<div className="p-12 animate-pulse text-zinc-500">Iniciando Offer Studio...</div>}>
                <OfferStudioClient orgId={org.id} orgSlug={slug} />
            </Suspense>
        </div>
    );
}
