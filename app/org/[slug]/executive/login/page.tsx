"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

import {
    getExecutiveLoginErrorMessage,
    resolvePostLoginPath,
} from "@/lib/executive/access";
import { resolveLoginErrorMessage } from "@/lib/auth/login-error-message";

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
        return "Credenciais inválidas.";
    }

    if (code === "FORBIDDEN" || error === "FORBIDDEN") {
        return "Acesso proibido para esta conta.";
    }

    if (code === "SERVICE_UNAVAILABLE" || error === "DATABASE_UNAVAILABLE") {
        return "Serviço temporariamente indisponível. Tente novamente em instantes.";
    }

    return payload?.error || "Não foi possível autenticar sua sessão.";
}

export default function ExecutiveTenantLoginPage() {
    const params = useParams<{ slug: string }>();
    const slug = params.slug;
    const router = useRouter();
    const searchParams = useSearchParams();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");

    const hint = useMemo(
        () => getExecutiveLoginErrorMessage(searchParams.get("reason")),
        [searchParams],
    );

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
                setError(resolveLoginErrorMessage(payload));
                return;
            }

            const destination = resolvePostLoginPath({
                orgSlug: payload.orgSlug,
                role: payload.role,
                requestedSurface: "executive",
            });

            router.push(destination);
            router.refresh();
        } catch {
            setError("Erro de conexão. Tente novamente.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#06111f] text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_28%)]" />
            <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
                <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                    <section className="rounded-[36px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.28)] md:p-10">
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                            <Sparkles className="h-3.5 w-3.5" />
                            CEO Mode
                        </div>

                        <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
                            Superfície executiva real para <span className="text-cyan-200">{slug}</span>
                        </h1>
                        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                            Login canônico do modo executivo. Usa a mesma sessão JWT do tenant, respeita isolamento por organização e só expõe o dashboard para perfis `admin` e `owner`.
                        </p>

                        <div className="mt-10 grid gap-4 md:grid-cols-2">
                            {[
                                "Receita e pipeline conectados a dados reais",
                                "Alertas executivos e perda estimada",
                                "Saúde operacional sem dados artificiais",
                                "Ponte explícita com o console operacional",
                            ].map((item) => (
                                <div key={item} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-slate-200">
                                    {item}
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-[36px] border border-white/10 bg-[#081525]/95 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.28)] md:p-10">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-200">
                                <LockKeyhole className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Executive Access</p>
                                <h2 className="text-2xl font-semibold tracking-tight">Entrar no modo CEO</h2>
                            </div>
                        </div>

                        {hint ? (
                            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                                {hint}
                            </div>
                        ) : null}

                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-200">E-mail</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="voce@empresa.com"
                                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-black/30"
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
                                        placeholder="••••••••"
                                        className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 pr-12 text-sm tracking-[0.2em] text-white outline-none transition focus:border-cyan-300/40 focus:bg-black/30"
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

                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? "Autenticando..." : "Entrar no Executive Mode"}
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </form>

                        <div className="mt-8 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
                            <div className="flex items-center gap-2 font-medium text-slate-100">
                                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                                O que acontece depois do login
                            </div>
                            <p className="mt-3 leading-6">
                                Perfis `admin` e `owner` seguem para o dashboard executivo. Perfis operacionais continuam autenticados, mas veem uma resposta clara de acesso negado para esta superfície.
                            </p>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
                            <Link
                                href={`/org/${slug}/admin/login`}
                                className="rounded-2xl border border-white/10 px-4 py-3 transition hover:border-white/20 hover:text-white"
                            >
                                Ir para login operacional
                            </Link>
                            <Link
                                href={`/org/${slug}/admin`}
                                className="rounded-2xl border border-white/10 px-4 py-3 transition hover:border-white/20 hover:text-white"
                            >
                                Abrir console tenant
                            </Link>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
