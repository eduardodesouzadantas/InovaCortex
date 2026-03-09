"use client";

import { useState } from "react";
import { Loader2, CheckCircle, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const NEXT_STATUS: Record<string, { label: string; icon: LucideIcon; next: string }> = {
    draft: { label: "Marcar como Revisado", icon: CheckCircle, next: "reviewed" },
    reviewed: { label: "Aprovar", icon: CheckCircle, next: "approved" },
    approved: { label: "Marcar como Postado", icon: Send, next: "posted" },
};

export function ContentReviewActions({
    artifactId,
    status,
    apiBasePath = "/api/admin/content",
}: {
    artifactId: string;
    status: string;
    apiBasePath?: string;
}) {
    const [loading, setLoading] = useState(false);
    const [current, setCurrent] = useState(status);
    const [error, setError] = useState<string>();

    const getErrorMessage = (value: unknown): string => {
        if (value instanceof Error) return value.message;
        return "Erro ao atualizar status";
    };

    const action = NEXT_STATUS[current];
    if (!action) return null;

    const Icon = action.icon;

    const handleTransition = async () => {
        setLoading(true);
        setError(undefined);
        try {
            const res = await fetch(apiBasePath, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: artifactId, status: action.next }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar status");
            setCurrent(action.next);
        } catch (error: unknown) {
            setError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-end gap-2">
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
            {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
    );
}
