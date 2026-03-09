"use client";

import { useState } from "react";
import { Loader2, CheckCircle, Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const NEXT_ACTION: Record<string, { label: string; next: string; icon: LucideIcon }> = {
    internal: { label: "Marcar como Anonimizado", next: "anonymized", icon: CheckCircle },
    anonymized: { label: "Aprovar", next: "approved", icon: CheckCircle },
    approved: { label: "Marcar como Publicado", next: "published", icon: Globe },
};

export function AuthorityStatusActions({
    assetId,
    status,
    apiBasePath = "/api/admin/authority",
    onStatusChanged,
}: {
    assetId: string;
    status: string;
    apiBasePath?: string;
    onStatusChanged?: (newStatus: string) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [current, setCurrent] = useState(status);
    const [error, setError] = useState<string>();
    const [publishedUrl, setPublishedUrl] = useState("");
    const [showUrlInput, setShowUrlInput] = useState(false);

    const getErrorMessage = (value: unknown): string => {
        if (value instanceof Error) return value.message;
        return "Erro ao atualizar status";
    };

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
            const res = await fetch(apiBasePath, {
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
            onStatusChanged?.(action.next);
        } catch (error: unknown) {
            setError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-end gap-2">
            {showUrlInput && (
                <input
                    type="url"
                    placeholder="URL publicada (opcional)"
                    value={publishedUrl}
                    onChange={(e) => setPublishedUrl(e.target.value)}
                    className="w-64 rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs"
                />
            )}
            <button onClick={handleTransition} disabled={loading} className="btn-primary flex items-center gap-2 whitespace-nowrap text-sm">
                {loading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                    </>
                ) : (
                    <>
                        <Icon className="h-4 w-4" /> {action.label}
                    </>
                )}
            </button>
            {error && <p className="text-right text-xs text-red-400">{error}</p>}
        </div>
    );
}
