"use client";

import { useState } from "react";
import { Loader2, CheckCircle, Clock, Send } from "lucide-react";

const NEXT_STATUS: Record<string, { label: string; icon: any; next: string }> = {
    draft: { label: "Marcar como Revisado", icon: CheckCircle, next: "reviewed" },
    reviewed: { label: "Aprovar", icon: CheckCircle, next: "approved" },
    approved: { label: "Marcar como Postado", icon: Send, next: "posted" },
};

export function ContentReviewActions({
    artifactId,
    status,
    orgSlug,
}: {
    artifactId: string;
    status: string;
    orgSlug: string;
}) {
    const [loading, setLoading] = useState(false);
    const [current, setCurrent] = useState(status);
    const [error, setError] = useState<string>();

    const action = NEXT_STATUS[current];
    if (!action) return null;

    const Icon = action.icon;

    const handleTransition = async () => {
        setLoading(true);
        setError(undefined);
        try {
            const res = await fetch("/api/admin/content", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: artifactId, status: action.next }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar status");
            setCurrent(action.next);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-end gap-2">
            <button onClick={handleTransition} disabled={loading}
                className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap">
                {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                    : <><Icon className="w-4 h-4" /> {action.label}</>
                }
            </button>
            {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
    );
}
