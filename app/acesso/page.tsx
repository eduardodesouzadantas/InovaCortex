import type { Metadata } from "next";
import Link from "next/link";

import { AcessoClient } from "./acesso-client";
import { getAuthContext } from "@/lib/auth/session";
import { resolveDefaultRedirect } from "@/lib/auth/resolveDefaultRedirect";

export const metadata: Metadata = {
    title: "Acesso | InovaCortex",
    description: "Escolha entre Agência e Empresa para entrar no ambiente correto da InovaCortex.",
};

export const dynamic = "force-dynamic";

export default async function AcessoPage({
    searchParams,
}: {
    searchParams?: { perfil?: string | string[] };
}) {
    const perfil = Array.isArray(searchParams?.perfil) ? searchParams?.perfil[0] : searchParams?.perfil;
    const preferredEntry = perfil === "empresa" ? "company" : "agency";
    const auth = await getAuthContext();
    const continueHref = auth.isAuthenticated ? await resolveDefaultRedirect() : null;

    return (
        <main className="min-h-screen bg-[#050816] text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.14),transparent_30%)]" />
            <div className="relative mx-auto max-w-7xl px-6 py-8 lg:px-8 lg:py-10">
                {continueHref ? (
                    <div className="mb-6 rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-50">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="font-semibold">Sessao ativa detectada</p>
                                <p className="mt-1 text-emerald-50/80">
                                    Se você já está autenticado, pode continuar direto para sua área.
                                </p>
                            </div>
                            <Link
                                href={continueHref}
                                className="inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-200 px-4 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-100"
                            >
                                Continuar para minha área
                            </Link>
                        </div>
                    </div>
                ) : null}

                <AcessoClient preferredEntry={preferredEntry} />
            </div>
        </main>
    );
}
