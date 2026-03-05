"use client";

import { Clock, User as UserIcon, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { HelpPopover } from "@/components/ui/help-popover";
import { getHelp } from "@/lib/help/use-help";
import { GUIDE_IDS } from "@/lib/help/guide-ids";

interface ConversationListProps {
    conversations: any[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
    return (
        <div data-guide-id={GUIDE_IDS.wa_inbox_list} id="inbox-list" className="flex flex-col">
            {conversations.map((convo) => {
                const isSelected = selectedId === convo.id;
                const lastMsgAt = convo.lastMessageAt ? new Date(convo.lastMessageAt) : new Date(convo.createdAt);
                const slaBreached = convo.slaDueAt && new Date(convo.slaDueAt) < new Date() && convo.status === 'open';
                const isUnread = convo.unreadCount > 0;

                return (
                    <button
                        key={convo.id}
                        onClick={() => onSelect(convo.id)}
                        className={`
              w-full p-4 flex gap-4 transition-all border-b border-white/[0.03] text-left relative
              ${isSelected ? "bg-white/[0.05]" : "hover:bg-white/[0.02]"}
            `}
                    >
                        {/* Left border indicator for selection */}
                        {isSelected && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold shadow-[0_0_10px_rgba(255,215,0,0.5)]" />
                        )}

                        {/* Avatar Placeholder */}
                        <div className="shrink-0 relative">
                            <div className={`
                w-12 h-12 rounded-full flex items-center justify-center border transition-colors
                ${isSelected ? "bg-gold/20 border-gold/40 text-gold" : "bg-white/5 border-white/10 text-white/20"}
              `}>
                                <UserIcon className="w-6 h-6" />
                            </div>
                            {isUnread && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-gold text-black text-[10px] font-black rounded-full flex items-center justify-center border-2 border-black shadow-lg">
                                    {convo.unreadCount}
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <h4 className={`text-sm font-semibold truncate ${isSelected ? "text-gold" : "text-white/80"}`}>
                                    {convo.contact.name || convo.contact.phoneNumberE164}
                                </h4>
                                <span className="text-[10px] text-white/30 whitespace-nowrap">
                                    {formatDistanceToNow(lastMsgAt, { addSuffix: false, locale: ptBR })}
                                </span>
                            </div>

                            <p className={`text-xs truncate ${isUnread ? "text-white/70 font-medium" : "text-white/30"}`}>
                                {convo.lastMessagePreview || "Inicie uma conversa..."}
                            </p>

                            <div className="flex items-center gap-3 mt-1">
                                {/* SLA Badge */}
                                {convo.status === "open" && convo.slaDueAt && (
                                    <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded
                    ${slaBreached ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"}
                  `}>
                                        <Clock className="w-2.5 h-2.5" />
                                        <span id="sla-badge">{slaBreached ? "SLA Estourado" : "SLA Ativo"}</span>
                                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="ml-1 flex items-center">
                                            <HelpPopover {...getHelp("sla")} />
                                        </div>
                                    </div>
                                )}

                                {/* Assigned Agent */}
                                {convo.user && (
                                    <div className="text-[9px] text-white/20 uppercase font-medium flex items-center gap-1">
                                        <div className="w-1 h-1 rounded-full bg-green-500" />
                                        {convo.user.name.split(' ')[0]}
                                    </div>
                                )}
                                {!convo.user && convo.status === 'open' && (
                                    <div className="text-[9px] text-amber-500/60 uppercase font-black flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                                        Aguardando
                                    </div>
                                )}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
