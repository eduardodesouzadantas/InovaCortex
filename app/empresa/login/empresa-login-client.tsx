"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Building2, Eye, EyeOff, Loader2, ShieldCheck, Sparkles } from "lucide-react";

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

export function EmpresaLoginClient({
    continueHref,
}: {
    continueHref: string | null;
}) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
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
            setLoading(false);
        }
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
            <section className="rounded-[36px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.24)] md:p-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-200">
                    <Sparkles className="h-3.5 w-3.5 text-amber-200" />
                    Entrada do cliente
                </div>

                <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
                    Acesso da Empresa
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                    Entre direto no ambiente da sua empresa. Nenhuma escolha de área, nenhum jargão interno.
                    Apenas sua conta e sua operação.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-slate-300">
                        Fluxo único e direto.
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-slate-300">
                        Compatível com login legado.
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-slate-300">
                        Funciona em mobile e desktop.
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-slate-300">
                        Empresa entra sem ambiguidade.
                    </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                        href="/avaliacao"
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/15"
                    >
                        Fazer Avaliação
                    </Link>
                </div>

                <p className="mt-3 text-xs leading-6 text-slate-400">
                    Acesso interno da agência continua direto em{" "}
                    <Link href="/agency/login" className="text-amber-200 transition hover:text-amber-100">
                        /agency/login
                    </Link>
                    .
                </p>
            </section>

            <section className="rounded-[36px] border border-white/10 bg-[#081525]/95 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.24)] md:p-10">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-200">
                        <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                            Empresa
                        </p>
                        <h2 className="text-2xl font-semibold tracking-tight">Entrar na Empresa</h2>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-200">E-mail</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="voce@empresa.com"
                            className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-amber-300/40 focus:bg-black/30"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-200">Senha</label>
                        <div className="relative">
                            <input
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
                        disabled={loading}
                        className="h-12 w-full rounded-2xl bg-amber-300 text-slate-950 hover:bg-amber-200"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                        {loading ? "Autenticando..." : "Entrar na Empresa"}
                    </Button>
                </form>

                <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
                    <div className="flex items-center gap-2 font-medium text-slate-100">
                        <ShieldCheck className="h-4 w-4 text-emerald-300" />
                        Fluxo canônico
                    </div>
                    <p className="mt-2 leading-6">
                        O login da empresa leva você ao console correto da organização sem mostrar áreas internas da agência.
                    </p>
                    {continueHref ? (
                        <Link
                            href={continueHref}
                            className="mt-3 inline-flex text-amber-200 transition hover:text-amber-100"
                        >
                            Continuar para minha área
                        </Link>
                    ) : null}
                </div>
            </section>
        </div>
    );
}
