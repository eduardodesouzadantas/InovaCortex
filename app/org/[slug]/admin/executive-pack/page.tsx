/**
 * app/org/[slug]/admin/executive-pack/page.tsx
 * V24: server shell for Executive Pack Generator
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { getAuthContext } from "@/lib/auth/session";
import { isAgencyMonitoringNamespaceEnabled } from "@/lib/agency/monitoring/flag";
import { ExecutivePackClient } from "./executive-pack-client";

export const metadata = { title: "Executive Pack · InovaCortex" };

export default async function ExecutivePackPage({ params }: { params: { slug: string } }) {
    const auth = await getAuthContext();
    if (isAgencyMonitoringNamespaceEnabled() && auth.isAuthenticated && auth.authScope === "agency") {
        redirect("/agency/executive-pack");
    }

    try {
        const ctx = await requireOrgContext(params.slug);
        assertRole(ctx.role, "admin");
    } catch {
        redirect(`/org/${params.slug}/admin/login`);
    }

    const org = await (prisma as any).organization.findUnique({
        where: { slug: params.slug },
        select: { id: true },
    }).catch(() => null);

    if (!org) notFound();

    return <ExecutivePackClient orgSlug={params.slug} orgId={org.id} />;
}
