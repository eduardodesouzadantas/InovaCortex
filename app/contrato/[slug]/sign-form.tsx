"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

interface Props {
    slug: string;
}

export function ContractSignForm({ slug }: Props) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!agreed) { setError("Você precisa marcar que leu e aceita os termos."); return; }
        if (!name.trim()) { setError("Nome completo é obrigatório."); return; }
        if (!email.includes("@")) { setError("E-mail inválido."); return; }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/public/contract/${slug}/sign`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Erro ao assinar contrato.");

            setDone(true);

            // Redirect to checkout after brief delay
            if (data.checkoutUrl) {
                setTimeout(() => { window.location.href = data.checkoutUrl; }, 1800);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="flex items-center gap-3 py-4 animate-in fade-in">
                <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                <div>
                    <p className="font-bold text-green-500">Contrato assinado!</p>
                    <p className="text-sm text-muted-foreground">Redirecionando para o pagamento…</p>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="sign-name">
                    Nome completo
                </label>
                <input
                    id="sign-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="sign-email">
                    E-mail
                </label>
                <input
                    id="sign-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                    required
                />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-primary rounded"
                />
                <span className="text-sm text-muted-foreground leading-relaxed">
                    Li e aceito integralmente os termos e condições deste contrato, incluindo escopo, prazo,
                    SLA, política de cancelamento e aceite eletrônico.
                </span>
            </label>

            {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={loading || !agreed}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Assinar e Continuar para Pagamento
            </button>
        </form>
    );
}
