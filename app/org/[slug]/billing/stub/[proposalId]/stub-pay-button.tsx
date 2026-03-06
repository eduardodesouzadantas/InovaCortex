"use client";

import { useState } from "react";
import { Zap, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
    proposalId: string;
}

export function StubPayButton({ proposalId }: Props) {
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleStubPay = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/public/billing/stub-pay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proposalId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Erro ao simular pagamento.");
            setDone(true);
            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="flex items-center justify-center gap-2 py-3 text-green-500 animate-in fade-in">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-bold">Pagamento simulado com sucesso!</span>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <button
                onClick={handleStubPay}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-base transition disabled:opacity-60"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-5 h-5" />}
                Simular Pagamento
            </button>
            {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
            )}
            <p className="text-xs text-muted-foreground text-center">
                Nenhuma cobrança real será realizada.
            </p>
        </div>
    );
}
