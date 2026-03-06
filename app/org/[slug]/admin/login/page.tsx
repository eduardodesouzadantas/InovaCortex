"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Loader2, Eye, EyeOff, Lock } from "lucide-react";

export default function OrgLoginPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = use(params);
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? "Falha no login");
                return;
            }

            // Redirect to the org admin — the role is embedded in the JWT
            router.push(`/org/${data.orgSlug}/admin`);
        } catch {
            setError("Erro de conexão. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex items-center gap-3 justify-center mb-10">
                    <BrainCircuit className="w-9 h-9 text-primary" />
                    <span className="font-bold text-2xl tracking-tight">InovaCortex</span>
                </div>

                <div className="glass-panel rounded-2xl border border-border/50 p-8">
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <Lock className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold mb-1">Mission Control</h1>
                        <p className="text-sm text-muted-foreground">
                            Acesso ao painel <strong>{slug}</strong>
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium block mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                required
                                className="w-full h-11 px-4 rounded-xl border border-border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium block mb-1.5">Senha</label>
                            <div className="relative">
                                <input
                                    type={showPwd ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full h-11 px-4 pr-12 rounded-xl border border-border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPwd(!showPwd)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn-primary h-11 flex items-center justify-center gap-2 font-semibold"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {isLoading ? "Entrando..." : "Entrar"}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-muted-foreground/50 mt-6">
                    InovaCortex Mission Control · Acesso restrito
                </p>
            </div>
        </div>
    );
}
