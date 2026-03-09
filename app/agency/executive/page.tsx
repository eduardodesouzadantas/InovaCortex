/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { buildExecutiveIntelligence } from "@/lib/agency/executive/intelligence-handler";
import { isAgencyMonitoringNamespaceEnabled } from "@/lib/agency/monitoring/flag";

export const runtime = "nodejs";

function formatBrl(value: number): string {
    return `R$ ${(value / 100).toLocaleString("pt-BR")}`;
}

export default async function AgencyExecutivePage() {
    if (!isAgencyMonitoringNamespaceEnabled()) {
        redirect("/agency/cockpit");
    }

    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency" || !auth.organizationId) {
        redirect("/agency/login");
    }

    const intelligence = await buildExecutiveIntelligence(auth.organizationId);
    const revenueBrain = (intelligence as any).revenueBrain;
    const leakDetector = (intelligence as any).leakDetector;
    const actionEngine = (intelligence as any).actionEngine;

    return (
        <section className="space-y-6">
            <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-400/90">Agency Executive</p>
                <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Global Executive Intelligence</h1>
                <p className="max-w-3xl text-sm text-slate-300">Endpoint canônico: <code>/api/agency/executive/intelligence</code>.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">Revenue Opportunity</p>
                    <p className="mt-1 text-xl font-bold text-slate-100">{formatBrl(revenueBrain?.totalOpportunity ?? 0)}</p>
                </article>
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">Detected Leaks</p>
                    <p className="mt-1 text-xl font-bold text-rose-300">{formatBrl(leakDetector?.totalLeakValue ?? 0)}</p>
                </article>
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-xs text-slate-400">Priority Actions</p>
                    <p className="mt-1 text-xl font-bold text-amber-200">{actionEngine?.actions?.length ?? 0}</p>
                </article>
            </div>

            <div className="flex flex-wrap gap-3">
                <Link href="/agency/command-center" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">Command Center</Link>
                <Link href="/agency/executive-pack" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">Executive Pack</Link>
                <a href="/api/agency/executive/intelligence" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">Raw API</a>
            </div>
        </section>
    );
}
