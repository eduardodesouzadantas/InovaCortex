"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
    User,
    Phone,
    ShieldCheck,
    Loader2,
    Check,
    CheckCheck,
    Clock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ComposeBox } from "./compose-box";
import { GUIDE_IDS } from "@/lib/help/guide-ids";

interface ChatPaneProps {
    conversation: {
        id: string;
        status: string;
        isOutside24h?: boolean;
        contact: {
            name?: string | null;
            phoneNumberE164?: string | null;
            lifecycle?: string | null;
            wa_id?: string | null;
            tags?: string | null;
            lastMessageAt?: string | null;
            optedOutAt?: string | null;
        };
    } | null;
    onConversationUpdated?: () => void;
}

type ConversationAction = "close" | "reopen" | "block_contact";

function parseTags(raw?: string | null): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map((tag) => String(tag)) : [];
    } catch {
        return [];
    }
}

function formatDistanceToNow(date: Date): string {
    const diff = (new Date().getTime() - date.getTime()) / 1000;
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)} min atras`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atras`;
    return `${Math.floor(diff / 86400)}d atras`;
}

export function ChatPane({ conversation, onConversationUpdated }: ChatPaneProps) {
    const params = useParams();
    const slug = params.slug as string;
    const conversationId = conversation?.id ?? null;
    const [messages, setMessages] = useState<Array<{
        id: string;
        type?: string | null;
        text?: string | null;
        status?: string | null;
        direction: "inbound" | "outbound";
        createdAt: string;
    }>>([]);
    const [loading, setLoading] = useState(true);
    const [messagesRefreshTick, setMessagesRefreshTick] = useState(0);
    const [actionLoading, setActionLoading] = useState<ConversationAction | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!conversationId) return;

        async function fetchMessages() {
            setLoading(true);
            try {
                const res = await fetch(`/api/org/${slug}/whatsapp/conversations/${conversationId}/messages`);
                const data = await res.json();
                setMessages(data.messages || []);
            } catch (err) {
                console.error("Failed to fetch messages:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchMessages();
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [slug, conversationId, messagesRefreshTick]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (!conversation) return null;

    const contact = conversation.contact;
    const isOutside24h = Boolean(conversation.isOutside24h);
    const parsedTags = parseTags(contact.tags);
    const isBlockedContact = Boolean(contact.optedOutAt);

    async function runConversationAction(action: ConversationAction) {
        if (!conversationId || actionLoading) return;
        setActionLoading(action);
        setActionError(null);

        try {
            const response = await fetch(`/api/org/${slug}/whatsapp/conversations/${conversationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || data?.message || "Falha ao executar acao");
            }

            setMessagesRefreshTick((prev) => prev + 1);
            onConversationUpdated?.();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Falha ao executar acao";
            setActionError(message);
        } finally {
            setActionLoading(null);
        }
    }

    return (
        <div className="flex h-full w-full overflow-hidden">
            <div data-guide-id={GUIDE_IDS.wa_chat_pane} className="flex-1 flex flex-col min-w-0 bg-transparent relative">
                <header className="h-16 border-b border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gold">
                            <User className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white/90">{contact.name || contact.phoneNumberE164}</h2>
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-medium text-white/40">
                                <span className="flex items-center gap-1">
                                    <div className="w-1 h-1 rounded-full bg-green-500" />
                                    Live
                                </span>
                                <span>-</span>
                                <span>{contact.phoneNumberE164}</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-[10px] uppercase tracking-widest text-white/30">Atendimento</div>
                </header>

                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar scroll-smooth"
                >
                    {loading && messages.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-gold/40" />
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const isOutbound = msg.direction === "outbound";
                            const date = new Date(msg.createdAt);
                            const showDateHeader = idx === 0 ||
                                format(new Date(messages[idx - 1].createdAt), "dd/MM") !== format(date, "dd/MM");

                            return (
                                <div key={msg.id} className="flex flex-col gap-4">
                                    {showDateHeader && (
                                        <div className="flex items-center justify-center my-4">
                                            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/30">
                                                {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                                            </div>
                                        </div>
                                    )}

                                    <div className={`flex w-full ${isOutbound ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[70%] group relative ${isOutbound ? "items-end" : "items-start"}`}>
                                            <div
                                                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg ${
                                                    isOutbound
                                                        ? "bg-gold/10 border border-gold/20 text-white rounded-tr-none"
                                                        : "bg-white/5 border border-white/10 text-white/90 rounded-tl-none"
                                                }`}
                                            >
                                                {msg.text || <span className="italic opacity-50">[{msg.type}]</span>}

                                                <div className={`mt-2 flex items-center gap-2 text-[10px] ${isOutbound ? "justify-end text-gold/40" : "text-white/20"}`}>
                                                    {format(date, "HH:mm")}
                                                    {isOutbound && (
                                                        <span className="ml-1">
                                                            {msg.status === "read" ? <CheckCheck className="w-3 h-3 text-blue-400" />
                                                                : msg.status === "delivered" ? <CheckCheck className="w-3 h-3" />
                                                                    : msg.status === "sent" ? <Check className="w-3 h-3" />
                                                                        : <Clock className="w-3 h-3" />}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <footer data-guide-id={GUIDE_IDS.wa_compose_box} className="p-4 shrink-0 bg-black/40 backdrop-blur-md border-t border-white/5 relative z-10">
                    <ComposeBox
                        conversationId={conversation.id}
                        isOutside24h={isOutside24h}
                        onSent={() => setMessagesRefreshTick((prev) => prev + 1)}
                    />
                </footer>
            </div>

            <div className="w-[300px] border-l border-white/5 bg-black/40 hidden xl:flex flex-col p-6 gap-8 shrink-0 overflow-y-auto">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold/20 to-amber-600/20 border-2 border-gold/30 flex items-center justify-center text-gold shadow-2xl shadow-gold/10">
                        <User className="w-10 h-10" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white/90">{contact.name || "Sem Nome"}</h3>
                        <p className="text-sm text-white/40">{contact.phoneNumberE164}</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-[10px] font-bold text-gold uppercase tracking-widest">
                            {contact.lifecycle}
                        </div>
                        {isOutside24h && (
                            <div className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                Sessao Expirada
                            </div>
                        )}
                    </div>
                </div>

                <div className="h-px bg-white/5" />

                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-white/30 flex items-center gap-2"><Clock className="w-4 h-4" /> Ultima msg</span>
                        <span className="text-white/60">
                            {contact.lastMessageAt ? formatDistanceToNow(new Date(contact.lastMessageAt)) : "-"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-white/30 flex items-center gap-2"><Phone className="w-4 h-4" /> WhatsApp ID</span>
                        <span className="text-white/60 font-mono">{contact.wa_id || "Nao mapeado"}</span>
                    </div>
                </div>

                <div className="h-px bg-white/5" />

                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Etiquetas</h4>
                        <span className="text-[10px] text-white/30 uppercase tracking-widest">Somente leitura</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {parsedTags.length > 0 ? (
                            parsedTags.map((tag: string) => (
                                <span key={tag} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/60">
                                    {tag}
                                </span>
                            ))
                        ) : (
                            <span className="text-[10px] text-white/20 italic">Nenhuma etiqueta definida</span>
                        )}
                    </div>
                </div>

                <div className="mt-auto flex flex-col gap-2">
                    {conversation.status === "open" ? (
                        <button
                            onClick={() => runConversationAction("close")}
                            disabled={Boolean(actionLoading)}
                            className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs font-bold text-white/80 uppercase tracking-widest disabled:opacity-50"
                        >
                            {actionLoading === "close" ? "Fechando..." : "Fechar Conversa"}
                        </button>
                    ) : (
                        <button
                            onClick={() => runConversationAction("reopen")}
                            disabled={Boolean(actionLoading) || isBlockedContact}
                            className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs font-bold text-white/80 uppercase tracking-widest disabled:opacity-50"
                        >
                            {actionLoading === "reopen" ? "Reabrindo..." : "Reabrir Conversa"}
                        </button>
                    )}

                    <button
                        onClick={() => runConversationAction("block_contact")}
                        disabled={Boolean(actionLoading) || isBlockedContact}
                        className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
                    >
                        {isBlockedContact ? "Contato bloqueado" : actionLoading === "block_contact" ? "Bloqueando..." : "Bloquear Contato"}
                    </button>

                    {actionError && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] text-red-300">
                            {actionError}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
