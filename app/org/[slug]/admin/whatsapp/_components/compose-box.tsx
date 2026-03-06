"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Send, LayoutGrid, Paperclip, Smile, AlertCircle, ShieldAlert, Loader2 } from "lucide-react";

interface ComposeBoxProps {
    conversationId: string;
    isOutside24h: boolean;
    onSent: () => void;
}

export function ComposeBox({ conversationId, isOutside24h, onSent }: ComposeBoxProps) {
    const params = useParams();
    const slug = params.slug as string;

    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);

    const handleSend = async () => {
        if (!text.trim() || sending) return;

        setSending(true);
        try {
            const res = await fetch(`/api/org/${slug}/whatsapp/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    conversationId,
                    text,
                    type: "text"
                })
            });

            if (res.ok) {
                setText("");
                onSent();
            } else {
                const err = await res.json();
                alert(err.message || "Erro ao enviar mensagem");
            }
        } catch (err) {
            console.error("Send error:", err);
        } finally {
            setSending(false);
        }
    };

    if (isOutside24h) {
        return (
            <div className="flex flex-col gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-amber-500 uppercase tracking-tight">Janela de Sessão Expirada</h4>
                        <p className="text-xs text-white/50 leading-relaxed mt-1">
                            O Meta não permite o envio de texto livre após 24 horas da última mensagem do contato.
                            Utilize um <strong>Template Autorizado</strong> para retomar o atendimento.
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
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Action bar */}
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

            {/* Input area */}
            <div className="relative flex items-end gap-3">
                <div className="flex-1 min-h-[48px] p-1 bg-white/5 border border-white/10 focus-within:border-gold/30 rounded-2xl transition-all">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Digite sua resposta..."
                        className="w-full bg-transparent border-none focus:ring-0 text-sm text-white/90 p-3 resize-none max-h-32 transition-all overflow-hidden"
                        rows={1}
                        style={{ height: 'auto' }}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                        }}
                    />
                </div>

                <button
                    onClick={handleSend}
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
        </div>
    );
}
