import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { isAgencyMonitoringNamespaceEnabled } from "@/lib/agency/monitoring/flag";

export const runtime = "nodejs";

export default async function AgencyMonitoringPage() {
    if (!isAgencyMonitoringNamespaceEnabled()) {
        redirect("/agency/cockpit");
    }

    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency") {
        redirect("/agency/login");
    }

    return (
        <section className="space-y-6">
            <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-400/90">Agency Monitoring</p>
                <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Monitoring Control Plane</h1>
                <p className="max-w-3xl text-sm text-slate-300">
                    Namespace canônico para orquestração, execução e eventos globais da operação interna.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <h2 className="text-sm font-semibold text-slate-100">Orchestrator</h2>
                    <p className="mt-1 text-xs text-slate-400">
                        Endpoints canônicos em <code>/api/agency/monitoring/orchestrator/*</code>.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <form action="/api/agency/monitoring/orchestrator/run" method="post">
                            <button className="rounded-md border border-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-800" type="submit">run</button>
                        </form>
                        <form action="/api/agency/monitoring/orchestrator/run-due" method="post">
                            <button className="rounded-md border border-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-800" type="submit">run-due</button>
                        </form>
                        <form action="/api/agency/monitoring/orchestrator/brain-cycle" method="post">
                            <button className="rounded-md border border-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-800" type="submit">brain-cycle</button>
                        </form>
                    </div>
                </article>

                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <h2 className="text-sm font-semibold text-slate-100">Cron + Profit Leaks</h2>
                    <p className="mt-1 text-xs text-slate-400">
                        Benchmarks e varredura de leaks globais em namespace agency.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <form action="/api/agency/monitoring/orchestrator/scan-profit-leaks" method="post">
                            <button className="rounded-md border border-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-800" type="submit">scan-profit-leaks</button>
                        </form>
                        <form action="/api/agency/monitoring/cron/benchmark-generate" method="post">
                            <button className="rounded-md border border-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-800" type="submit">benchmark-generate</button>
                        </form>
                    </div>
                </article>
            </div>

            <div className="flex flex-wrap gap-3">
                <Link href="/agency/command-center" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">Command Center</Link>
                <Link href="/agency/costs" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">Costs</Link>
                <Link href="/agency/executive" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">Executive</Link>
            </div>
        </section>
    );
}
