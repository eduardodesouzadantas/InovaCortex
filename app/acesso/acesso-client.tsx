"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Building2, Crown, Eye, EyeOff, Loader2, ShieldCheck, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolvePostLoginPath } from "@/lib/executive/access";

type LoginResponseBody = {
    error?: string;
    code?: string;
    success?: boolean;
    orgSlug?: string;
    role?: "owner" | "admin" | "closer" | "viewer";
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

export function AcessoClient({
    preferredEntry = "agency",
}: {
    preferredEntry?: "agency" | "company";
}) {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const emailId = "company-access-email";
    const passwordId = "company-access-password";

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const payload = (await response.json()) as LoginResponseBody;

            if (!response.ok || !payload.success || !payload.orgSlug || !payload.role) {
                setError(toLoginErrorMessage(payload));
                return;
            }

            router.push(
                resolvePostLoginPath({
                    orgSlug: payload.orgSlug,
                    role: payload.role,
                    requestedSurface: "admin",
                }),
            );
            router.refresh();
        } catch {
            setError("Erro de conexao. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    }

    const agencyCard = (
        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.24)] md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                <Crown className="h-3.5 w-3.5" />
                Agência
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">Entrar como Agência</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
                Acesso ao plano operacional da própria agência, com as superfícies de comando e execução.
            </p>

                <div className="mt-6 space-y-3 text-sm text-slate-300">
                    <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-cyan-200" />
                        <span>Login direto do time da agência.</span>
                    </div>
                <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                    <Users className="mt-0.5 h-4 w-4 text-cyan-200" />
                    <span>Fluxo separado da área da empresa.</span>
                </div>
            </div>

            <Button asChild className="mt-6 h-12 w-full rounded-2xl bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                <Link href="/agency/login">
                    Entrar na Agência
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
        </section>
    );

    const companyCard = (
        <section className="rounded-[32px] border border-white/10 bg-[#081525]/95 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.24)] md:p-8">
            <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-200">
                    <Building2 className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Empresa</p>
                    <h2 className="text-2xl font-semibold tracking-tight text-white">Entrar como Empresa</h2>
                </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-300">
                Acesso da empresa com login por e-mail e senha. O sistema encaminha a sessão para o console
                operacional correto após validar a organização.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                    <label htmlFor={emailId} className="mb-2 block text-sm font-medium text-slate-200">
                        E-mail
                    </label>
                    <input
                        id={emailId}
                        type="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="voce@empresa.com"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-amber-300/40 focus:bg-black/30"
                    />
                </div>

                <div>
                    <label htmlFor={passwordId} className="mb-2 block text-sm font-medium text-slate-200">
                        Senha
                    </label>
                    <div className="relative">
                        <input
                            id={passwordId}
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="********"
                            className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 pr-12 text-sm tracking-[0.2em] text-white outline-none transition focus:border-amber-300/40 focus:bg-black/30"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-white"
                            aria-label="Alternar visibilidade da senha"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                {error ? (
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                        {error}
                    </div>
                ) : null}

                <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-12 w-full rounded-2xl bg-amber-300 text-slate-950 hover:bg-amber-200"
                >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                    {isLoading ? "Autenticando..." : "Entrar na Empresa"}
                </Button>
            </form>

            <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
                <p className="font-medium text-slate-100">Fluxo oficial</p>
                <p className="mt-2 leading-6">
                    O login da empresa preserva a sessão tenant e direciona cada conta para a superfície correta
                    sem exigir slug manual.
                </p>
            </div>
        </section>
    );

    const cards = preferredEntry === "company" ? [companyCard, agencyCard] : [agencyCard, companyCard];
    const orderedCards = cards.map((card, index) => (
        <div key={index}>{card}</div>
    ));

    return (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
            <section className="rounded-[36px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.24)] md:p-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-200">
                    <Sparkles className="h-3.5 w-3.5 text-amber-200" />
                    Entrada oficial
                </div>
                <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
                    Portal de acesso da InovaCortex
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                    Escolha a superfície correta para entrar. Agência e Empresa seguem fluxos diferentes por
                    design, sem misturar operação, autenticação ou contexto de tenant.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-slate-300">
                        Entrada segregada por perfil.
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-slate-300">
                        Compatível com rotas legadas.
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-slate-300">
                        Mobile e desktop com o mesmo fluxo.
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-slate-300">
                        Sem dependência de slug manual para empresa.
                    </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                        href="/agency/login"
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                    >
                        Entrar na Agência
                    </Link>
                    <Link
                        href="/acesso?perfil=empresa"
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/15"
                    >
                        Entrar como Empresa
                    </Link>
                </div>
            </section>

            <div className="space-y-6">
                {orderedCards}
            </div>
        </div>
    );
}
