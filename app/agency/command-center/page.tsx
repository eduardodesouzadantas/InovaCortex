import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { getLiveKPIs } from "@/lib/kpi-engine";
import { isAgencyMonitoringNamespaceEnabled } from "@/lib/agency/monitoring/flag";

export const runtime = "nodejs";

function formatBrl(cents: number): string {
    return `R$ ${(cents / 100).toLocaleString("pt-BR")}`;
}

export default async function AgencyCommandCenterPage() {
    if (!isAgencyMonitoringNamespaceEnabled()) {
        redirect("/agency/cockpit");
    }

    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency" || !auth.organizationId) {
        redirect("/agency/login");
    }

    const kpis = await getLiveKPIs(auth.organizationId);

    return (
        <section className="space-y-6">
            <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-400/90">Agency Command Center</p>
                <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Global Command Center</h1>
                <p className="max-w-3xl text-sm text-slate-300">Visão operacional global da agência, fora da superfície tenant.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">Monthly Revenue</p>
                    <p className="mt-1 text-xl font-bold text-slate-100">{formatBrl(kpis.monthlyRevenueCents)}</p>
                </article>
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">Pipeline Value</p>
                    <p className="mt-1 text-xl font-bold text-slate-100">{formatBrl(kpis.pipelineValueCents)}</p>
                </article>
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">Open Leak Value</p>
                    <p className="mt-1 text-xl font-bold text-rose-300">{formatBrl(kpis.lostRevenueCents)}</p>
                </article>
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">Active Workspaces</p>
                    <p className="mt-1 text-xl font-bold text-amber-200">{kpis.activeWorkspaces}</p>
                </article>
            </div>

            <div className="flex flex-wrap gap-3">
                <Link href="/agency/monitoring" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">Monitoring</Link>
                <Link href="/agency/executive" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">Executive</Link>
                <Link href="/agency/costs" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">Costs</Link>
            </div>
        </section>
    );
}
