"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircle, Loader2 } from "lucide-react";

export function PropostaActionButtons({ slug }: { slug: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const [done, setDone] = useState<"accepted" | "adjust" | null>(null);

    const respond = async (action: "accept" | "adjust") => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/proposta/${slug}/respond`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            if (!res.ok) throw new Error("Falha ao registrar resposta.");
            setDone(action === "accept" ? "accepted" : "adjust");
        } catch (e) {
            alert("Erro ao enviar resposta. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    if (done === "accepted") {
        return (
            <div className="flex items-center justify-center gap-3 py-6 rounded-2xl bg-green-500/10 border border-green-500/20 animate-in fade-in">
                <CheckCircle2 className="w-7 h-7 text-green-500" />
                <div>
                    <p className="font-bold text-green-500">Proposta Aceita!</p>
                    <p className="text-sm text-muted-foreground">Entraremos em contato para iniciar o onboarding.</p>
                </div>
            </div>
        );
    }

    if (done === "adjust") {
        return (
            <div className="flex items-center justify-center gap-3 py-6 rounded-2xl bg-blue-400/10 border border-blue-400/20 animate-in fade-in">
                <MessageCircle className="w-7 h-7 text-blue-400" />
                <div>
                    <p className="font-bold text-blue-400">Solicitação Registrada</p>
                    <p className="text-sm text-muted-foreground">Nossa equipe analisará o pedido e enviará uma proposta revisada.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col sm:flex-row gap-4">
            <button
                onClick={() => respond("adjust")}
                disabled={isLoading}
                className="flex-1 btn-secondary flex items-center justify-center gap-2 py-4 text-base"
            >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                Solicitar Ajuste
            </button>
            <button
                onClick={() => respond("accept")}
                disabled={isLoading}
                className="flex-1 btn-primary flex items-center justify-center gap-2 py-4 text-base font-bold"
            >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Aceitar Proposta
            </button>
        </div>
    );
}
