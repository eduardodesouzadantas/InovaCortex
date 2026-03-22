"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Crown, Loader2, Shield, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

type LoginResponseBody = {
    error?: string;
    code?: string;
    success?: boolean;
};

export const agencyLoginNavigation = {
    goToDashboard: () => window.location.assign("/agency/dashboard"),
};

function toLoginErrorMessage(payload: LoginResponseBody | null | undefined): string {
    const code = payload?.code?.trim().toUpperCase();
    const error = payload?.error?.trim().toUpperCase();

    if (code === "UNAUTHORIZED" || error === "INVALID_CREDENTIALS" || error === "UNAUTHORIZED") {
        return "Credenciais invalidas";
    }

    if (code === "FORBIDDEN" || error === "FORBIDDEN") {
        return "Acesso proibido para esta conta";
    }

    if (code === "SERVICE_UNAVAILABLE" || error === "DATABASE_UNAVAILABLE") {
        return "Servico temporariamente indisponivel. Tente novamente em instantes.";
    }

    return payload?.error || "Acesso negado";
}

export default function AgencyLoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/agency/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = (await res.json()) as LoginResponseBody;

            if (!res.ok || !data.success) {
                setError(toLoginErrorMessage(data));
                return;
            }

            agencyLoginNavigation.goToDashboard();
        } catch {
            setError("Erro de conexao");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10 text-white">
            <div className="absolute inset-0 bg-[#07111d]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.10),transparent_30%)]" />

            <section className="relative w-full max-w-lg rounded-[36px] border border-white/10 bg-[rgba(8,21,37,0.92)] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.28)] backdrop-blur md:p-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                    <Crown className="h-3.5 w-3.5" />
                    Agency Surface
                </div>

                <div className="mt-6 flex items-center gap-3">
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                        <Shield className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                            Agency Login
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                            Acesso da Agencia
                        </h1>
                    </div>
                </div>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                    Entrada interna para a equipe da agencia. Esta superficie fica isolada do site comercial e
                    mantem a autenticacao intacta.
                </p>

                <form onSubmit={handleLogin} className="mt-8 space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-200">E-mail</label>
                        <input
                            type="email"
                            placeholder="E-mail de acesso..."
                            value={email}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                            required
                            className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-black/30"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-200">Senha</label>
                        <input
                            type="password"
                            placeholder="Senha de acesso..."
                            value={password}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            required
                            className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm tracking-widest text-white outline-none transition focus:border-cyan-300/40 focus:bg-black/30"
                        />
                    </div>

                    {error && <p className="text-sm text-rose-200">{error}</p>}

                    <Button
                        type="submit"
                        className="h-12 w-full rounded-2xl bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                        {loading ? "Verificando..." : "Autenticar"}
                    </Button>
                </form>

                <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
                    <div className="flex items-center gap-2 font-medium text-slate-100">
                        <ShieldCheck className="h-4 w-4 text-emerald-300" />
                        Acesso restrito
                    </div>
                    <p className="mt-2 leading-6">
                        Use este fluxo apenas para contas da agencia. A empresa entra diretamente em{" "}
                        <Link href="/empresa/login" className="text-cyan-200 hover:text-cyan-100">
                            Acesso da empresa
                        </Link>
                        .
                    </p>
                </div>
            </section>
        </main>
    );
}
