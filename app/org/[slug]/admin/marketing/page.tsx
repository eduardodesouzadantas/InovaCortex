/**
 * app/org/[slug]/admin/marketing/page.tsx
 * V20.1: Marketing Calendar Admin UI.
 *
 * Shows the 30-day editorial calendar for an org with:
 * - Status badges + platform + postType chips
 * - Filters: status / platform / postType
 * - Action buttons: "Revisar", "Aprovar", "Agendar (best hour)", "Publicar agora"
 * - "Pack pronto" column with copy button when status = ready_to_post
 *
 * Access: only org admins (checked via session).
 */

import { notFound, redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { MarketingCalendarClient } from "./marketing-calendar-client";

interface Props {
    params: { slug: string };
    searchParams: { status?: string; platform?: string; postType?: string };
}

async function getOrgAndPlans(slug: string, filters: { status?: string; platform?: string; postType?: string }) {
    const { prisma } = await import("@/lib/prisma");

    const org = await (prisma as any).organization.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true },
    }).catch(() => null);

    if (!org) return null;

    const where: any = { orgId: org.id };
    if (filters.status) where.status = filters.status;
    if (filters.platform) where.platform = filters.platform;
    if (filters.postType) where.postType = filters.postType;

    const plans = await (prisma as any).marketingPlan.findMany({
        where,
        orderBy: { day: "asc" },
        take: 30,
    }).catch(() => []);

    return { org, plans };
}

export default async function MarketingAdminPage({ params, searchParams }: Props) {
    let ctx;
    try { ctx = await requireOrgContext(params.slug); }
    catch { redirect(`/org/${params.slug}/admin/login`); }

    const data = await getOrgAndPlans(params.slug, searchParams);
    if (!data) notFound();

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white">
                        📅 Calendário de Marketing
                    </h1>
                    <p className="text-gray-400 mt-1">{data.org.name} · {data.plans.length} entradas</p>
                </div>

                <MarketingCalendarClient
                    orgSlug={params.slug}
                    orgId={data.org.id}
                    plans={data.plans}
                    activeFilters={searchParams}
                />
            </div>
        </div>
    );
}
