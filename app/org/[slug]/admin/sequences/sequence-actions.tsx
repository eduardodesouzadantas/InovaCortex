"use client";

import { useState } from "react";
import { Loader2, Play, Pause, CheckCircle, XCircle, ChevronRight } from "lucide-react";

interface Props {
    sequenceId: string;
    assessmentId: string;
    status: string;
}

export function SequenceActions({ sequenceId, assessmentId, status }: Props) {
    const [loading, setLoading] = useState<string | null>(null);
    const [current, setCurrent] = useState(status);
    const [error, setError] = useState<string>();

    const act = async (action: string) => {
        setLoading(action);
        setError(undefined);
        try {
            const res = await fetch("/api/admin/sequences", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, sequenceId, assessmentId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Erro");

            if (action === "pause") setCurrent("paused");
            if (action === "resume") setCurrent("active");
            if (action === "convert") setCurrent("completed");
            if (action === "optout") setCurrent("opted_out");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(null);
        }
    };

    const isLoading = (a: string) => loading === a;

    return (
        <div className="flex flex-col items-end gap-1.5 shrink-0">
            {current === "active" && (
                <>
                    <button onClick={() => act("next")} disabled={!!loading}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors">
                        {isLoading("next") ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                        Próximo passo
                    </button>
                    <button onClick={() => act("pause")} disabled={!!loading}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border/40 text-muted-foreground hover:border-border transition-colors">
                        {isLoading("pause") ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
                        Pausar
                    </button>
                    <button onClick={() => act("convert")} disabled={!!loading}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors">
                        {isLoading("convert") ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Convertido
                    </button>
                    <button onClick={() => act("optout")} disabled={!!loading}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-red-400/20 text-red-400/70 hover:bg-red-400/10 transition-colors">
                        {isLoading("optout") ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        Saiu
                    </button>
                </>
            )}
            {current === "paused" && (
                <button onClick={() => act("resume")} disabled={!!loading}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/20 transition-colors">
                    {isLoading("resume") ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Retomar
                </button>
            )}
            {error && <p className="text-xs text-red-400 max-w-[140px] text-right">{error}</p>}
        </div>
    );
}
