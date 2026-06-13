"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, LayoutGrid, Loader2, Send, ShieldAlert, Smile, Paperclip, X } from "lucide-react";
import { readApiData } from "./api-envelope";

interface ComposeBoxProps {
    slug?: string;
    conversationId: string;
    isOutside24h: boolean;
    onSent: () => void;
}

type TemplateItem = {
    id: string;
    name: string;
    status: string;
    language: string;
};

function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}

export function ComposeBox({ slug: providedSlug, conversationId, isOutside24h, onSent }: ComposeBoxProps) {
    const params = useParams();
    const slug = providedSlug ?? (params.slug as string);

    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [templates, setTemplates] = useState<TemplateItem[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!showTemplates) return;
        async function loadTemplates() {
            setTemplatesLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/org/${slug}/whatsapp/templates`);
                const data = await readApiData<{ templates?: TemplateItem[] }>(res, "Falha ao carregar templates");
                const approved = (data.templates || []).filter((tmpl: TemplateItem) => tmpl.status === "approved");
                setTemplates(approved);
            } catch (err: unknown) {
                setError(getErrorMessage(err, "Erro ao carregar templates"));
            } finally {
                setTemplatesLoading(false);
            }
        }
        loadTemplates();
    }, [showTemplates, slug]);

    const handleSendText = async () => {
        if (!text.trim() || sending) return;

        setSending(true);
        setError(null);
        try {
            const res = await fetch(`/api/org/${slug}/whatsapp/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    conversationId,
                    text,
                    type: "text",
                }),
            });
            await readApiData<unknown>(res, "Erro ao enviar mensagem");
            setText("");
            onSent();
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Erro ao enviar mensagem"));
        } finally {
            setSending(false);
        }
    };

    const handleSendTemplate = async (templateName: string, templateLanguage: string) => {
        if (sending) return;
        setSending(true);
        setError(null);
        try {
            const res = await fetch(`/api/org/${slug}/whatsapp/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    conversationId,
                    type: "template",
                    templateName,
                    templateLanguage,
                }),
            });
            await readApiData<unknown>(res, "Erro ao enviar template");
            setShowTemplates(false);
            onSent();
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Erro ao enviar template"));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col gap-3 relative">
            {showTemplates && (
                <div className="absolute bottom-[72px] left-0 right-0 z-20 rounded-2xl border border-white/10 bg-black/95 p-3 shadow-2xl">
                    <div className="flex items-center justify-between mb-3">
                        <h5 className="text-xs uppercase tracking-widest text-white/60 font-bold">Templates aprovados</h5>
                        <button
                            onClick={() => setShowTemplates(false)}
                            className="p-1 rounded hover:bg-white/10 text-white/40"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    {templatesLoading ? (
                        <div className="py-6 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-gold/60" />
                        </div>
                    ) : templates.length === 0 ? (
                        <p className="text-xs text-white/40 py-3">Nenhum template aprovado disponível.</p>
                    ) : (
                        <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                            {templates.map((tmpl) => (
                                <button
                                    key={tmpl.id}
                                    onClick={() => handleSendTemplate(tmpl.name, tmpl.language)}
                                    disabled={sending}
                                    className="text-left rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:border-gold/30 hover:bg-gold/5 transition-all disabled:opacity-50"
                                >
                                    <div className="text-sm text-white/90 font-semibold">{tmpl.name}</div>
                                    <div className="text-[10px] text-white/40 uppercase tracking-widest">{tmpl.language}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isOutside24h ? (
                <div className="flex flex-col gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-amber-500 uppercase tracking-tight">Janela de Sessão Expirada</h4>
                            <p className="text-xs text-white/50 leading-relaxed mt-1">
                                O Meta não permite envio livre após 24h da última mensagem.
                                Use um template aprovado para reengajar o contato.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowTemplates(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gold text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gold/90 transition-all shadow-lg shadow-gold/10"
                    >
                        <LayoutGrid className="w-4 h-4" />
                        Selecionar Template
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-4 px-2">
                        <button className="text-white/30 hover:text-gold transition-colors">
                            <Paperclip className="w-5 h-5" />
                        </button>
                        <button className="text-white/30 hover:text-gold transition-colors">
                            <Smile className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setShowTemplates(true)}
                            className="text-white/30 hover:text-gold transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest"
                        >
                            <LayoutGrid className="w-4 h-4" />
                            Templates
                        </button>
                        <div className="ml-auto flex items-center gap-2 text-[10px] text-white/20 font-medium uppercase tracking-widest">
                            <AlertCircle className="w-3 h-3" />
                            Modo Livre Ativo
                        </div>
                    </div>

                    <div className="relative flex items-end gap-3">
                        <div className="flex-1 min-h-[48px] p-1 bg-white/5 border border-white/10 focus-within:border-gold/30 rounded-2xl transition-all">
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendText();
                                    }
                                }}
                                placeholder="Digite sua resposta..."
                                className="w-full bg-transparent border-none focus:ring-0 text-sm text-white/90 p-3 resize-none max-h-32 transition-all overflow-hidden"
                                rows={1}
                                style={{ height: "auto" }}
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = "auto";
                                    target.style.height = `${target.scrollHeight}px`;
                                }}
                            />
                        </div>

                        <button
                            onClick={handleSendText}
                            disabled={!text.trim() || sending}
                            className={`
            w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0
            ${!text.trim() || sending
                                    ? "bg-white/5 text-white/10 cursor-not-allowed"
                                    : "bg-gold text-black shadow-lg shadow-gold/20 hover:scale-105 active:scale-95"
                                }
          `}
                        >
                            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                </>
            )}

            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error}
                </div>
            )}
        </div>
    );
}
