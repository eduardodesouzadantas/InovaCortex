/**
 * app/org/[slug]/admin/outbound/page.tsx
 * V21: LinkedIn Outbound Admin Hub — 4 sections.
 *
 * 1) Prospect Radar   — generate stubs, import CSV, filter table
 * 2) Sequences       — active cadences, stage, next send, pause/resume
 * 3) Message Log     — last 100 messages, copy text, mark sent
 * 4) Metrics         — pipeline funnel stats + replies by template
 */

import { notFound, redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { OutboundClient } from "./outbound-client";

interface Props {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ tab?: string; status?: string; industry?: string }>;
}

async function getData(slug: string, filters: { status?: string; industry?: string }) {
    const { prisma } = await import("@/lib/prisma");

    const org = await (prisma as any).organization.findUnique({
        where: { slug }, select: { id: true, name: true, slug: true },
    }).catch(() => null);
    if (!org) return null;

    const pWhere: any = { orgId: org.id };
    if (filters.status) pWhere.status = filters.status;
    if (filters.industry) pWhere.industry = filters.industry;

    const [prospects, sequences, messages, metricsRaw] = await Promise.all([
        (prisma as any).prospect.findMany({
            where: pWhere, orderBy: { createdAt: "desc" }, take: 200,
        }).catch(() => []),
        (prisma as any).outboundSequence.findMany({
            where: { orgId: org.id, stage: { not: "done" } },
            include: { prospect: { select: { fullName: true, company: true, status: true } } },
            orderBy: { nextAt: "asc" },
            take: 50,
        }).catch(() => []),
        (prisma as any).outboundMessage.findMany({
            where: { orgId: org.id },
            include: { prospect: { select: { fullName: true, company: true } } },
            orderBy: { createdAt: "desc" },
            take: 100,
        }).catch(() => []),
        // Metrics
        Promise.all([
            (prisma as any).prospect.count({ where: { orgId: org.id } }).catch(() => 0),
            (prisma as any).prospect.count({ where: { orgId: org.id, status: "connected" } }).catch(() => 0),
            (prisma as any).prospect.count({ where: { orgId: org.id, status: "replied" } }).catch(() => 0),
            (prisma as any).prospect.count({ where: { orgId: org.id, status: "meeting" } }).catch(() => 0),
        ]),
    ]);

    const [total, connected, replied, meetings] = metricsRaw as number[];

    return {
        org, prospects, sequences, messages,
        metrics: { total, connected, replied, meetings },
    };
}

export default async function OutboundAdminPage({ params, searchParams }: Props) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const slug = resolvedParams.slug;

    let ctx;
    try { ctx = await requireOrgContext(slug); }
    catch { redirect(`/org/${slug}/admin/login`); }

    const data = await getData(slug, resolvedSearchParams);
    if (!data) notFound();

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">🎯 LinkedIn Outbound</h1>
                    <p className="text-gray-400 mt-1">{data.org.name} · Cadência automatizada</p>
                </div>
                <OutboundClient
                    orgSlug={slug}
                    prospects={data.prospects}
                    sequences={data.sequences}
                    messages={data.messages}
                    metrics={data.metrics}
                    activeFilters={resolvedSearchParams}
                    activeTab={resolvedSearchParams.tab ?? "radar"}
                />
            </div>
        </div>
    );
}
