/**
 * app/org/[slug]/admin/builder/page.tsx
 * V25: Internal Builder Autopilot — gated server shell.
 *
 * Returns 403 for any org that is not "inovacortex" AND
 * doesn't have SystemSetting internal_builder_enabled=true.
 */

import { notFound } from "next/navigation";
import { BuilderClient } from "./builder-client";

export const metadata = { title: "Builder Autopilot · Internal" };

async function resolveGate(slug: string): Promise<boolean> {
    const { prisma } = await import("@/lib/prisma");

    const org = await (prisma as any).organization.findUnique({
        where: { slug }, select: { slug: true },
    }).catch(() => null);

    if (!org) return false;
    if (org.slug === "inovacortex") return true;

    const setting = await (prisma as any).appSetting.findUnique({

        where: { key: "internal_builder_enabled" },
    }).catch(() => null);

    return setting?.value === "true";
}

export default async function BuilderPage({ params }: { params: { slug: string } }) {
    const allowed = await resolveGate(params.slug);
    if (!allowed) notFound();

    return <BuilderClient orgSlug={params.slug} />;
}
