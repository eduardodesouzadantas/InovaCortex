"use client";

import { useState } from "react";
import { Loader2, CheckCircle, Globe } from "lucide-react";

const NEXT_ACTION: Record<string, { label: string; next: string; icon: any }> = {
    internal: { label: "Marcar como Anonimizado", next: "anonymized", icon: CheckCircle },
    anonymized: { label: "Aprovar", next: "approved", icon: CheckCircle },
    approved: { label: "Marcar como Publicado", next: "published", icon: Globe },
};

export function AuthorityStatusActions({
    assetId,
    status,
}: {
    assetId: string;
    status: string;
}) {
    const [loading, setLoading] = useState(false);
    const [current, setCurrent] = useState(status);
    const [error, setError] = useState<string>();
    const [publishedUrl, setPublishedUrl] = useState("");
    const [showUrlInput, setShowUrlInput] = useState(false);

    const action = NEXT_ACTION[current];
    if (!action) return null;

    const Icon = action.icon;

    const handleTransition = async () => {
        if (action.next === "published" && !showUrlInput) {
            setShowUrlInput(true);
            return;
        }

        setLoading(true);
        setError(undefined);
        try {
            const res = await fetch("/api/admin/authority", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "status",
                    assetId,
                    status: action.next,
                    publishedUrl: publishedUrl || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar status");
            setCurrent(action.next);
            setShowUrlInput(false);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-end gap-2">
            {showUrlInput && (
                <input
                    type="url"
                    placeholder="URL onde foi publicado (opcional)"
                    value={publishedUrl}
                    onChange={e => setPublishedUrl(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/20 w-64"
                />
            )}
            <button onClick={handleTransition} disabled={loading}
                className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap">
                {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                    : <><Icon className="w-4 h-4" /> {action.label}</>
                }
            </button>
            {error && <p className="text-xs text-red-400 text-right">{error}</p>}
        </div>
    );
}
