/**
 * app/org/[slug]/admin/executive-pack/page.tsx
 * V24: server shell for Executive Pack Generator
 */

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ExecutivePackClient } from "./executive-pack-client";

export const metadata = { title: "Executive Pack · InovaCortex" };

export default async function ExecutivePackPage({ params }: { params: { slug: string } }) {
    const org = await (prisma as any).organization.findUnique({
        where: { slug: params.slug },
        select: { id: true },
    }).catch(() => null);

    if (!org) notFound();

    return <ExecutivePackClient orgSlug={params.slug} orgId={org.id} />;
}
