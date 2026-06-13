"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
    User,
    Loader2,
    Check,
    CheckCheck,
    Clock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ComposeBox } from "./compose-box";
import { ConversationCommercialContext } from "./conversation-commercial-context";
import { GUIDE_IDS } from "@/lib/help/guide-ids";
import { readApiData } from "./api-envelope";
import type { CrmEditableField, CrmPlaybookId } from "@/lib/operator/crm-workspace";
import type { WhatsAppConversationCommercialContext } from "@/lib/whatsapp/conversation-service";

interface ChatPaneProps {
    slug?: string;
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

export function ChatPane({ slug: providedSlug, conversation, onConversationUpdated }: ChatPaneProps) {
    const params = useParams();
    const slug = providedSlug ?? (params.slug as string);
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
    const [contextRefreshTick, setContextRefreshTick] = useState(0);
    const [actionLoading, setActionLoading] = useState<ConversationAction | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [commercialContext, setCommercialContext] = useState<WhatsAppConversationCommercialContext | null>(null);
    const [contextLoading, setContextLoading] = useState(false);
    const [contextError, setContextError] = useState<string | null>(null);
    const [commercialPendingKey, setCommercialPendingKey] = useState<string | null>(null);
    const [commercialNotice, setCommercialNotice] = useState<{ tone: "positive" | "warning" | "critical"; message: string } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!conversationId) return;

        async function fetchMessages() {
            setLoading(true);
            try {
                const res = await fetch(`/api/org/${slug}/whatsapp/conversations/${conversationId}/messages`);
                const data = await readApiData<{ messages?: typeof messages }>(res, "Falha ao carregar mensagens");
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

    useEffect(() => {
        if (!conversationId) return;

        let active = true;
        setContextLoading(true);
        setContextError(null);

        fetch(`/api/org/${slug}/whatsapp/conversations/${conversationId}/context`)
            .then((response) => readApiData<WhatsAppConversationCommercialContext>(response, "Falha ao carregar contexto comercial"))
            .then((data) => {
                if (!active) return;
                setCommercialContext(data);
            })
            .catch((error) => {
                if (!active) return;
                setCommercialContext(null);
                setContextError(error instanceof Error ? error.message : "Falha ao carregar contexto comercial");
            })
            .finally(() => {
                if (!active) return;
                setContextLoading(false);
            });

        return () => {
            active = false;
        };
    }, [slug, conversationId, contextRefreshTick]);

    if (!conversation) return null;

    const contact = conversation.contact;
    const isOutside24h = Boolean(conversation.isOutside24h);
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
            setContextRefreshTick((prev) => prev + 1);
            onConversationUpdated?.();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Falha ao executar acao";
            setActionError(message);
        } finally {
            setActionLoading(null);
        }
    }

    async function runCommercialInlineAction(assessmentId: string, payload: { field: CrmEditableField; value: string }) {
        const mutationKey = `${assessmentId}:${payload.field}`;
        setCommercialPendingKey(mutationKey);
        setCommercialNotice(null);

        try {
            const response = await fetch(`/api/org/${slug}/crm/records/${assessmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            await readApiData(response, "Falha ao atualizar contexto comercial");
            setCommercialNotice({
                tone: "positive",
                message: "Contexto comercial atualizado.",
            });
            setContextRefreshTick((prev) => prev + 1);
            onConversationUpdated?.();
        } catch (error) {
            setCommercialNotice({
                tone: "critical",
                message: error instanceof Error ? error.message : "Falha ao atualizar contexto comercial",
            });
        } finally {
            setCommercialPendingKey(null);
        }
    }

    async function runCommercialPlaybook(assessmentId: string, playbookId: CrmPlaybookId) {
        setCommercialPendingKey(`playbook:${playbookId}`);
        setCommercialNotice(null);

        try {
            const response = await fetch(`/api/org/${slug}/crm/playbooks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    assessmentIds: [assessmentId],
                    playbookId,
                    sourceViewId: null,
                }),
            });

            const result = await readApiData<{ successCount: number; failureCount: number }>(response, "Falha ao executar playbook comercial");
            setCommercialNotice({
                tone: result.failureCount > 0 ? "warning" : "positive",
                message: result.failureCount > 0
                    ? `${result.successCount} acao comercial aplicada e ${result.failureCount} falhou.`
                    : "Playbook comercial executado com sucesso.",
            });
            setContextRefreshTick((prev) => prev + 1);
            onConversationUpdated?.();
        } catch (error) {
            setCommercialNotice({
                tone: "critical",
                message: error instanceof Error ? error.message : "Falha ao executar playbook comercial",
            });
        } finally {
            setCommercialPendingKey(null);
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
                        slug={slug}
                        conversationId={conversation.id}
                        isOutside24h={isOutside24h}
                        onSent={() => {
                            setMessagesRefreshTick((prev) => prev + 1);
                            setContextRefreshTick((prev) => prev + 1);
                        }}
                    />
                </footer>
            </div>

            <ConversationCommercialContext
                context={commercialContext}
                conversationStatus={conversation.status}
                contact={contact}
                isOutside24h={isOutside24h}
                isBlockedContact={isBlockedContact}
                actionLoading={actionLoading}
                actionError={actionError}
                commercialPendingKey={commercialPendingKey}
                commercialNotice={commercialNotice}
                contextLoading={contextLoading}
                contextError={contextError}
                onConversationAction={runConversationAction}
                onCommercialInlineAction={runCommercialInlineAction}
                onCommercialPlaybook={runCommercialPlaybook}
            />
        </div>
    );
}
