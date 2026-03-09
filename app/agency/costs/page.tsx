/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isAgencyMonitoringNamespaceEnabled } from "@/lib/agency/monitoring/flag";

export const runtime = "nodejs";

function formatUsd(value: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatInt(value: number): string {
    return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

export default async function AgencyCostsPage() {
    if (!isAgencyMonitoringNamespaceEnabled()) {
        redirect("/agency/cockpit");
    }

    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency") {
        redirect("/agency/login");
    }

    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const startOfMonth = new Date(`${month}-01T00:00:00.000Z`);

    const [orgCount, invocations, usageSnapshots] = await Promise.all([
        (prisma as any).organization.count(),
        (prisma as any).aIInvocation.aggregate({
            where: { createdAt: { gte: startOfMonth } },
            _sum: { estimatedCostUsd: true, promptTokens: true, completionTokens: true },
            _count: { _all: true },
        }),
        (prisma as any).monthlyUsageSnapshot.findMany({
            where: { month },
            orderBy: { assessmentsCount: "desc" },
            take: 10,
            include: { organization: { select: { slug: true, name: true } } },
        }),
    ]);

    const totalCostUsd = invocations._sum.estimatedCostUsd ?? 0;
    const totalTokens = (invocations._sum.promptTokens ?? 0) + (invocations._sum.completionTokens ?? 0);
    const totalCalls = invocations._count._all ?? 0;

    return (
        <section className="space-y-6">
            <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-400/90">Agency Costs</p>
                <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Global Usage & Costs</h1>
                <p className="max-w-3xl text-sm text-slate-300">Visão consolidada de consumo global da agência no mês corrente.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">Organizations</p>
                    <p className="mt-1 text-2xl font-bold text-slate-100">{formatInt(orgCount)}</p>
                </article>
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">AI Calls ({month})</p>
                    <p className="mt-1 text-2xl font-bold text-slate-100">{formatInt(totalCalls)}</p>
                </article>
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">Tokens ({month})</p>
                    <p className="mt-1 text-2xl font-bold text-slate-100">{formatInt(totalTokens)}</p>
                </article>
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">Estimated Cost USD</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-300">{formatUsd(totalCostUsd)}</p>
                </article>
            </div>

            <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-100">Top Usage Snapshots ({month})</h2>
                    <a
                        href="/api/agency/costs/usage/recalculate"
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    >
                        Recalculate
                    </a>
                </div>
                <div className="space-y-2 text-xs text-slate-300">
                    {usageSnapshots.length === 0 && <p className="text-slate-500">Sem snapshots para o período.</p>}
                    {usageSnapshots.map((snapshot: any) => (
                        <div key={snapshot.organizationId} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                            <span>{snapshot.organization?.name ?? snapshot.organization?.slug ?? snapshot.organizationId}</span>
                            <span className="text-slate-400">
                                assessments {snapshot.assessmentsCount} · proposals {snapshot.proposalCount} · pdf {snapshot.pdfCount}
                            </span>
                        </div>
                    ))}
                </div>
            </article>
        </section>
    );
}
