"use client";

import { useState } from "react";
import { MessageSquare, Send, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
    workspaceId: string;
    taskId: string;
    token: string;
}

export function TaskComment({ workspaceId, taskId, token }: Props) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = value.trim();
        if (!text) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/public/workspace/${workspaceId}/comment?t=${encodeURIComponent(token)}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ body: text, taskId }),
                }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Erro ao enviar.");
            setSent(true);
            setValue("");
            setTimeout(() => { setSent(false); setOpen(false); }, 2500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="flex items-center gap-2 text-xs text-green-500 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Dúvida enviada! Nossa equipe responderá em breve.
            </div>
        );
    }

    return (
        <div>
            {!open ? (
                <button
                    onClick={() => setOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Tenho uma dúvida sobre esta tarefa
                </button>
            ) : (
                <form onSubmit={handleSubmit} className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1">
                    <textarea
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder="Descreva sua dúvida ou pedido (máx. 1000 caracteres)…"
                        rows={3}
                        maxLength={1000}
                        className="w-full text-xs bg-background border border-border/60 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 transition"
                    />
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={loading || !value.trim()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Enviar
                        </button>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground transition"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
