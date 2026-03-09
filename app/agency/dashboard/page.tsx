import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Layers, Compass } from "lucide-react";
import { getAuthContext } from "@/lib/auth/session";

export const runtime = "nodejs";

function isAgencyShellEnabled(): boolean {
    const raw = process.env.FF_AGENCY_SHELL;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export default async function AgencyDashboardPage() {
    if (!isAgencyShellEnabled()) {
        redirect("/admin");
    }

    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency") {
        redirect("/agency/login");
    }

    return (
        <section className="space-y-6">
            <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-400/90">Agency Control Plane</p>
                <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Agency Dashboard</h1>
                <p className="max-w-2xl text-sm text-slate-300">
                    Camada interna oficial da InovaCortex. Este espaco e separado do tenant client e da camada publica.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="mb-3 inline-flex rounded-lg bg-cyan-500/10 p-2 text-cyan-300">
                        <ShieldCheck className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-semibold text-slate-100">Camada Protegida</h2>
                    <p className="mt-1 text-xs text-slate-400">
                        Namespace dedicado para operacoes da agencia com escopo separado de tenant.
                    </p>
                </article>

                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="mb-3 inline-flex rounded-lg bg-emerald-500/10 p-2 text-emerald-300">
                        <Layers className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-semibold text-slate-100">Nucleo Executivo</h2>
                    <p className="mt-1 text-xs text-slate-400">
                        Dashboard, cockpit e configuracoes agora consolidados sob <code>/agency/*</code>.
                    </p>
                </article>

                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="mb-3 inline-flex rounded-lg bg-violet-500/10 p-2 text-violet-300">
                        <Compass className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-semibold text-slate-100">Entrypoint Canonico</h2>
                    <p className="mt-1 text-xs text-slate-400">
                        Esta rota e o ponto oficial de entrada operacional da camada agency.
                    </p>
                </article>
            </div>

            <div className="flex flex-wrap gap-3">
                <Link
                    href="/agency/cockpit"
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                >
                    Abrir cockpit
                </Link>
                <Link
                    href="/agency/settings"
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                >
                    Abrir configuracoes
                </Link>
            </div>
        </section>
    );
}
