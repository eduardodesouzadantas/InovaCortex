"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Search, Loader2, MessageSquare } from "lucide-react";
import { ConversationList } from "./conversation-list";
import { ChatPane } from "./chat-pane";
import { HelpPopover } from "@/components/ui/help-popover";
import { getHelp } from "@/lib/help/use-help";
import { GUIDE_IDS } from "@/lib/help/guide-ids";
import { readApiData } from "./api-envelope";

export function InboxTab({ slug: providedSlug, initialConversationId = null }: { slug?: string; initialConversationId?: string | null }) {
    const params = useParams();
    const slug = providedSlug ?? (params.slug as string);

    const [conversations, setConversations] = useState<Array<{
        id: string;
        createdAt: string;
        status: string;
        unreadCount: number;
        lastMessageAt?: string | null;
        lastMessagePreview?: string | null;
        slaDueAt?: string | null;
        isOutside24h?: boolean;
        contact: {
            name?: string | null;
            phoneNumberE164?: string | null;
            tags?: string | null;
            lifecycle?: string | null;
            wa_id?: string | null;
            lastMessageAt?: string | null;
            optedOutAt?: string | null;
        };
        user?: {
            name?: string | null;
            email?: string | null;
        } | null;
    }>>([]);
    const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState("open");
    const [refreshTick, setRefreshTick] = useState(0);

    useEffect(() => {
        let cancelled = false;

        async function fetchConversations(showLoadingState: boolean) {
            if (showLoadingState) {
                setLoading(true);
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                const res = await fetch(`/api/org/${slug}/whatsapp/conversations?status=${filter}`, {
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                const data = await readApiData<{
                    conversations?: typeof conversations;
                }>(res, "Falha ao carregar conversas");
                if (!cancelled) {
                    setConversations(data.conversations || []);
                    setError(null);
                    setHasLoadedOnce(true);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("Failed to fetch conversations:", err);
                    setConversations([]);
                    setError(
                        err instanceof Error && err.name === "AbortError"
                            ? "Timeout ao carregar conversas"
                            : err instanceof Error
                                ? err.message
                                : "Falha ao carregar conversas",
                    );
                    setHasLoadedOnce(true);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void fetchConversations(!hasLoadedOnce);

        const interval = setInterval(() => {
            void fetchConversations(false);
        }, 10000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [slug, filter, refreshTick, hasLoadedOnce]);

    useEffect(() => {
        if (!selectedConvoId) return;
        const stillExists = conversations.some((item) => item.id === selectedConvoId);
        if (!stillExists) {
            setSelectedConvoId(null);
        }
    }, [conversations, selectedConvoId]);

    useEffect(() => {
        if (!initialConversationId || selectedConvoId) return;
        const requestedConversation = conversations.find((item) => item.id === initialConversationId);
        if (requestedConversation) {
            setSelectedConvoId(requestedConversation.id);
        }
    }, [conversations, initialConversationId, selectedConvoId]);

    const selectedConvo = conversations.find((conversation) => conversation.id === selectedConvoId);

    return (
        <div className="flex h-full w-full">
            <div data-guide-id="wa_inbox_list" className="w-[350px] lg:w-[400px] border-r border-white/5 bg-black/10 flex flex-col shrink-0 overflow-hidden">
                <div className="p-4 border-b border-white/5 shrink-0 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                            Fila de Atendimento
                            <HelpPopover {...getHelp("conversationStatus")} />
                        </span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                            type="text"
                            placeholder="Buscar historico..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-gold/50 transition-colors"
                        />
                    </div>
                    <div className="flex bg-white/5 p-1 rounded-lg">
                        {["open", "snoozed", "closed"].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilter(status)}
                                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all
                  ${filter === status ? "bg-gold text-black shadow-lg" : "text-white/40 hover:text-white/60"}`}
                            >
                                {status === "open" ? "Abertos" : status === "snoozed" ? "Adiados" : "Fechados"}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading && conversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-white/20">
                            <Loader2 className="w-8 h-8 animate-spin mb-3" />
                            <p className="text-xs uppercase tracking-widest font-medium">Carregando...</p>
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center text-white/30">
                            <p className="text-xs uppercase tracking-widest font-medium text-red-300/80">Falha ao carregar a fila</p>
                            <p className="mt-2 text-xs text-white/30">{error}</p>
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="p-12 text-center text-white/20">
                            <p className="text-xs">Nenhuma conversa encontrada</p>
                        </div>
                    ) : (
                        <ConversationList
                            conversations={conversations}
                            selectedId={selectedConvoId}
                            onSelect={setSelectedConvoId}
                        />
                    )}
                </div>
            </div>

            <div data-guide-id={GUIDE_IDS.wa_chat_pane} className="flex-1 bg-black/20 overflow-hidden relative">
                {selectedConvoId ? (
                    <ChatPane
                        slug={slug}
                        conversation={selectedConvo ?? null}
                        onConversationUpdated={() => setRefreshTick((prev) => prev + 1)}
                    />
                ) : (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-24 h-24 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-6">
                                <MessageSquare className="w-10 h-10 text-white/10" />
                            </div>
                            <h3 className="text-lg font-medium text-white/40 mb-2">Selecione uma conversa</h3>
                            <p className="text-sm text-white/20 max-w-xs">Escolha um lead a esquerda para visualizar o historico de mensagens e iniciar o atendimento.</p>
                        </div>
                        <div
                            data-guide-id={GUIDE_IDS.wa_compose_box}
                            className="border-t border-white/5 bg-black/40 px-4 py-5 text-center text-[10px] uppercase tracking-widest text-white/20"
                        >
                            Selecione uma conversa para habilitar a resposta
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
