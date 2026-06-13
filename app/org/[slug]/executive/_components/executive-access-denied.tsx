import Link from "next/link";
import { AlertTriangle, ArrowLeft, ShieldX } from "lucide-react";

export function ExecutiveAccessDenied({
    slug,
}: {
    slug: string;
}) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#06111f] px-6 py-10 text-white">
            <div className="w-full max-w-2xl rounded-[32px] border border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(6,17,31,0.95))] p-8 shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
                    <ShieldX className="h-3.5 w-3.5" />
                    Executive Access
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-300">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-semibold tracking-tight">Acesso executivo indisponível para este perfil</h1>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                                O modo executivo exige papel `admin` ou `owner`. Sua sessão continua válida, mas esta superfície não é exposta para perfis operacionais de menor privilégio.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-slate-300">
                        Tenant atual: <span className="font-semibold text-white">{slug}</span>
                    </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                        href={`/org/${slug}/admin`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Ir para console operacional
                    </Link>
                    <Link
                        href={`/org/${slug}/executive/login`}
                        className="inline-flex items-center rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
                    >
                        Trocar conta
                    </Link>
                </div>
            </div>
        </div>
    );
}
