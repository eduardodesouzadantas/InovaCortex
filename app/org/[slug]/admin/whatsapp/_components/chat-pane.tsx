"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
    User,
    Phone,
    Calendar,
    Tag,
    ShieldCheck,
    Loader2,
    MoreVertical,
    Check,
    CheckCheck,
    Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ComposeBox } from "./compose-box";
import { GUIDE_IDS } from "@/lib/help/guide-ids";

interface ChatPaneProps {
    conversation: any | null;
}

export function ChatPane({ conversation }: ChatPaneProps) {
    const params = useParams();
    const slug = params.slug as string;
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!conversation) return;

        async function fetchMessages() {
            setLoading(true);
            try {
                const res = await fetch(`/api/org/${slug}/whatsapp/conversations/${conversation.id}/messages`);
                const data = await res.json();
                setMessages(data.messages || []);
            } catch (err) {
                console.error("Failed to fetch messages:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchMessages();
        const interval = setInterval(fetchMessages, 5000); // Fast poll for active chat
        return () => clearInterval(interval);
    }, [slug, conversation?.id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (!conversation) return null;

    const contact = conversation.contact;
    const isOutside24h = conversation.isOutside24h;

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* Main Chat Content */}
            <div data-guide-id={GUIDE_IDS.wa_chat_pane} className="flex-1 flex flex-col min-w-0 bg-transparent relative">
                {/* Chat Header */}
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
                                <span>•</span>
                                <span>{contact.phoneNumberE164}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/40">
                            <MoreVertical className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Messages List */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar scroll-smooth"
                >
                    {loading && messages.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-gold/40" />
                        </div>
                    ) : (
                        messages.map((msg: any, idx: number) => {
                            const isOutbound = msg.direction === "outbound";
                            const date = new Date(msg.createdAt);
                            const showDateHeader = idx === 0 ||
                                format(new Date(messages[idx - 1].createdAt), 'dd/MM') !== format(date, 'dd/MM');

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
                                        <div className={`
                      max-w-[70%] group relative
                      ${isOutbound ? "items-end" : "items-start"}
                    `}>
                                            <div className={`
                        px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg
                        ${isOutbound
                                                    ? "bg-gold/10 border border-gold/20 text-white rounded-tr-none"
                                                    : "bg-white/5 border border-white/10 text-white/90 rounded-tl-none"
                                                }
                      `}>
                                                {msg.text || <span className="italic opacity-50">[{msg.type}]</span>}

                                                <div className={`mt-2 flex items-center gap-2 text-[10px] ${isOutbound ? "justify-end text-gold/40" : "text-white/20"}`}>
                                                    {format(date, "HH:mm")}
                                                    {isOutbound && (
                                                        <span className="ml-1">
                                                            {msg.status === 'read' ? <CheckCheck className="w-3 h-3 text-blue-400" /> :
                                                                msg.status === 'delivered' ? <CheckCheck className="w-3 h-3" /> :
                                                                    msg.status === 'sent' ? <Check className="w-3 h-3" /> :
                                                                        <Clock className="w-3 h-3" />}
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

                {/* Compose Area */}
                <footer data-guide-id={GUIDE_IDS.wa_compose_box} className="p-4 shrink-0 bg-black/40 backdrop-blur-md border-t border-white/5 relative z-10">
                    <ComposeBox
                        conversationId={conversation.id}
                        isOutside24h={isOutside24h}
                        onSent={() => { }} // Polling will catch it
                    />
                </footer>
            </div>

            {/* Right Details Pane (Info/Tags/Actions) */}
            <div className="w-[300px] border-l border-white/5 bg-black/40 hidden xl:flex flex-col p-6 gap-8 shrink-0 overflow-y-auto">
                {/* Contact Profile Section */}
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
                                Sessão Expirada
                            </div>
                        )}
                    </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Quick Details */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-white/30 flex items-center gap-2"><Clock className="w-4 h-4" /> Última msg</span>
                        <span className="text-white/60">{formatDistanceToNow(new Date(contact.lastMessageAt), { addSuffix: true, locale: ptBR })}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-white/30 flex items-center gap-2"><Phone className="w-4 h-4" /> WhatsApp ID</span>
                        <span className="text-white/60 font-mono">{contact.wa_id || "Não mapeado"}</span>
                    </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Tags Section */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Etiquetas</h4>
                        <button className="text-[10px] text-gold hover:underline">Editar</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {JSON.parse(contact.tags || "[]").length > 0 ? (
                            JSON.parse(contact.tags).map((tag: string) => (
                                <span key={tag} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/60">
                                    {tag}
                                </span>
                            ))
                        ) : (
                            <span className="text-[10px] text-white/20 italic">Nenhuma etiqueta definida</span>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-auto flex flex-col gap-2">
                    <button className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs font-bold text-white/60 uppercase tracking-widest">
                        Fechar Conversa
                    </button>
                    <button className="w-full py-2.5 rounded-xl border border-red-500/20 text-red-500/60 hover:bg-red-500/10 transition-all text-[10px] font-bold uppercase tracking-widest">
                        Bloquear Contato
                    </button>
                </div>
            </div>
        </div>
    );
}

// Internal helper for distance time (could normally be imported but kept here for stability)
function formatDistanceToNow(date: Date, options: any) {
    const diff = (new Date().getTime() - date.getTime()) / 1000;
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return `${Math.floor(diff / 86400)}d atrás`;
}
