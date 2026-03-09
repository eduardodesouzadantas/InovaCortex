import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Shield, SlidersHorizontal } from "lucide-react";
import { getAuthContext } from "@/lib/auth/session";

export const runtime = "nodejs";

function isAgencyShellEnabled(): boolean {
    const raw = process.env.FF_AGENCY_SHELL;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export default async function AgencyCockpitPage() {
    if (!isAgencyShellEnabled()) {
        redirect("/admin/cockpit");
    }

    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency") {
        redirect("/agency/login");
    }

    return (
        <section className="space-y-6">
            <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-400/90">Agency Executive Core</p>
                <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Agency Cockpit</h1>
                <p className="max-w-2xl text-sm text-slate-300">
                    Painel executivo inicial da camada interna. Esta rota consolida a operacao de cockpit no namespace
                    agency sem migrar os modulos completos ainda.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="mb-3 inline-flex rounded-lg bg-cyan-500/10 p-2 text-cyan-300">
                        <Activity className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-semibold text-slate-100">Cockpit Namespace</h2>
                    <p className="mt-1 text-xs text-slate-400">
                        Rota canônica de cockpit movida para <code className="text-slate-200">/agency/cockpit</code>.
                    </p>
                </article>

                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="mb-3 inline-flex rounded-lg bg-violet-500/10 p-2 text-violet-300">
                        <Shield className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-semibold text-slate-100">Segregacao de Camada</h2>
                    <p className="mt-1 text-xs text-slate-400">
                        Acesso sob guard agency, isolado da camada tenant e da camada publica.
                    </p>
                </article>

                <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="mb-3 inline-flex rounded-lg bg-emerald-500/10 p-2 text-emerald-300">
                        <SlidersHorizontal className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-semibold text-slate-100">Proximos Passos</h2>
                    <p className="mt-1 text-xs text-slate-400">
                        Os modulos executivos serao acoplados neste shell nas proximas ondas.
                    </p>
                </article>
            </div>

            <div className="flex flex-wrap gap-3">
                <Link
                    href="/agency/dashboard"
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                >
                    Voltar para dashboard
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
