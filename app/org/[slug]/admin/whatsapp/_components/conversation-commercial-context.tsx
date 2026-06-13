"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, MessageSquare, Phone, ShieldCheck, User } from "lucide-react";

import type { CrmEditableField, CrmPlaybookId } from "@/lib/operator/crm-workspace";
import type { WhatsAppConversationCommercialContext } from "@/lib/whatsapp/conversation-service";

type ConversationAction = "close" | "reopen" | "block_contact";

function toneClasses(tone: "neutral" | "positive" | "warning" | "critical") {
    switch (tone) {
        case "positive":
            return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
        case "warning":
            return "border-amber-400/20 bg-amber-400/10 text-amber-100";
        case "critical":
            return "border-rose-400/20 bg-rose-400/10 text-rose-100";
        default:
            return "border-white/10 bg-white/[0.03] text-slate-100";
    }
}

function formatDistanceToNow(date: Date): string {
    const diff = (new Date().getTime() - date.getTime()) / 1000;
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)} min atras`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atras`;
    return `${Math.floor(diff / 86400)}d atras`;
}

export function ConversationCommercialContext({
    context,
    conversationStatus,
    contact,
    isOutside24h,
    isBlockedContact,
    actionLoading,
    actionError,
    commercialPendingKey,
    commercialNotice,
    contextLoading,
    contextError,
    onConversationAction,
    onCommercialInlineAction,
    onCommercialPlaybook,
}: {
    context: WhatsAppConversationCommercialContext | null;
    conversationStatus: string;
    contact: {
        name?: string | null;
        phoneNumberE164?: string | null;
        lifecycle?: string | null;
        wa_id?: string | null;
        tags?: string | null;
        lastMessageAt?: string | null;
    };
    isOutside24h: boolean;
    isBlockedContact: boolean;
    actionLoading: ConversationAction | null;
    actionError: string | null;
    commercialPendingKey: string | null;
    commercialNotice: { tone: "positive" | "warning" | "critical"; message: string } | null;
    contextLoading: boolean;
    contextError: string | null;
    onConversationAction?: (action: ConversationAction) => void;
    onCommercialInlineAction?: (assessmentId: string, payload: { field: CrmEditableField; value: string }) => void;
    onCommercialPlaybook?: (assessmentId: string, playbookId: CrmPlaybookId) => void;
}) {
    const [stageDraft, setStageDraft] = useState(context?.record?.stageId ?? "");
    const parsedTags = context?.contact.tags ?? [];

    useEffect(() => {
        setStageDraft(context?.record?.stageId ?? "");
    }, [context?.record?.assessmentId, context?.record?.stageId]);

    return (
        <div className="w-[320px] border-l border-white/5 bg-black/40 hidden xl:flex flex-col p-6 gap-6 shrink-0 overflow-y-auto">
            <div className="flex flex-col items-center text-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold/20 to-amber-600/20 border-2 border-gold/30 flex items-center justify-center text-gold shadow-2xl shadow-gold/10">
                    <User className="w-10 h-10" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white/90">{contact.name || "Sem Nome"}</h3>
                    <p className="text-sm text-white/40">{contact.phoneNumberE164}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                    <div className="px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-[10px] font-bold text-gold uppercase tracking-widest">
                        {context?.contact.lifecycle || contact.lifecycle || "lead"}
                    </div>
                    {isOutside24h ? (
                        <div className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Sessao expirada
                        </div>
                    ) : null}
                    <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${toneClasses(context?.attention.tone ?? "neutral")}`}>
                        {context?.attention.label ?? "Sem contexto"}
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Conversa</p>
                <div className="mt-3 grid gap-2 text-sm text-slate-300">
                    <p className="flex items-center justify-between gap-3"><span className="text-slate-500">Status</span><span>{conversationStatus}</span></p>
                    <p className="flex items-center justify-between gap-3"><span className="text-slate-500">Ultima msg</span><span>{contact.lastMessageAt ? formatDistanceToNow(new Date(contact.lastMessageAt)) : "-"}</span></p>
                    <p className="flex items-center justify-between gap-3"><span className="text-slate-500">WhatsApp ID</span><span className="font-mono text-xs">{context?.contact.waId || contact.wa_id || "Nao mapeado"}</span></p>
                    <p className="text-sm leading-6 text-slate-400">{context?.attention.detail ?? "Sem sinal comercial adicional para esta conversa ainda."}</p>
                </div>
            </div>

            {contextLoading ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-slate-400">
                    Carregando contexto comercial...
                </div>
            ) : null}

            {contextError ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
                    {contextError}
                </div>
            ) : null}

            {!contextLoading && !contextError ? (
                <>
                    {context?.record ? (
                        <>
                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Contexto comercial</p>
                                <div className="mt-3 grid gap-2 text-sm text-slate-300">
                                    <p className="flex items-center justify-between gap-3"><span className="text-slate-500">Conta</span><span>{context.record.company}</span></p>
                                    <p className="flex items-center justify-between gap-3"><span className="text-slate-500">Status</span><span>{context.record.status}</span></p>
                                    <p className="flex items-center justify-between gap-3"><span className="text-slate-500">Score</span><span>{context.record.scoreLabel}</span></p>
                                    <p className="flex items-center justify-between gap-3"><span className="text-slate-500">Stage</span><span>{context.record.stageLabel}</span></p>
                                    <p className="flex items-center justify-between gap-3"><span className="text-slate-500">Proposta</span><span>{context.record.proposalLabel}</span></p>
                                    <p className="flex items-center justify-between gap-3"><span className="text-slate-500">Prioridade</span><span>{context.record.priority}</span></p>
                                    <p className="flex items-center justify-between gap-3"><span className="text-slate-500">Cadencia</span><span>{context.record.cadenceLabel}</span></p>
                                    <p className="text-sm leading-6 text-white">{context.record.nextAction}</p>
                                    <p className="flex items-center gap-2 text-xs text-slate-400"><Clock className="w-3.5 h-3.5" /> {context.record.nextActionAtLabel}</p>
                                </div>
                            </div>

                            {context.record.stageOptions.length > 0 ? (
                                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Atualizar stage</p>
                                    <div className="mt-3 grid gap-3">
                                        <select
                                            value={stageDraft}
                                            onChange={(event) => setStageDraft(event.target.value)}
                                            disabled={commercialPendingKey === `${context.record.assessmentId}:deal.stageId`}
                                            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-gold/40 disabled:opacity-60"
                                        >
                                            <option value="">Selecionar stage</option>
                                            {context.record.stageOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => stageDraft && onCommercialInlineAction?.(context.record!.assessmentId, { field: "deal.stageId", value: stageDraft })}
                                            disabled={!stageDraft || commercialPendingKey === `${context.record.assessmentId}:deal.stageId`}
                                            className="rounded-xl border border-gold/20 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            Atualizar stage
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            {context.quickActions.length > 0 ? (
                                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Quick actions comerciais</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {context.quickActions.map((action) => {
                                            const className = `rounded-xl border px-3 py-2 text-sm font-medium transition ${toneClasses(action.tone)}`;
                                            if (action.kind === "link" && action.href) {
                                                return <Link key={action.id} href={action.href} className={className}>{action.label}</Link>;
                                            }

                                            if (action.kind === "playbook" && action.playbookId) {
                                                return (
                                                    <button
                                                        key={action.id}
                                                        type="button"
                                                        onClick={() => onCommercialPlaybook?.(action.assessmentId, action.playbookId!)}
                                                        disabled={commercialPendingKey === `playbook:${action.playbookId}`}
                                                        className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
                                                    >
                                                        {action.label}
                                                    </button>
                                                );
                                            }

                                            if (action.kind === "inline-update" && action.field && typeof action.value === "string") {
                                                return (
                                                    <button
                                                        key={action.id}
                                                        type="button"
                                                        onClick={() => onCommercialInlineAction?.(action.assessmentId, { field: action.field!, value: action.value! })}
                                                        disabled={commercialPendingKey === `${action.assessmentId}:${action.field}`}
                                                        className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
                                                    >
                                                        {action.label}
                                                    </button>
                                                );
                                            }

                                            return null;
                                        })}
                                    </div>
                                </div>
                            ) : null}

                            {context.recommendations.length > 0 ? (
                                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Proxima melhor acao</p>
                                    <div className="mt-3 space-y-3">
                                        {context.recommendations.map((recommendation) => (
                                            <div key={recommendation.id} className="rounded-xl border border-white/8 bg-black/10 p-3">
                                                <p className="text-sm font-semibold text-white">{recommendation.title}</p>
                                                <p className="mt-1 text-sm leading-6 text-slate-300">{recommendation.reason}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Atividades recentes</p>
                                <div className="mt-3 space-y-3">
                                    {context.recentEvents.length > 0 ? context.recentEvents.map((item) => (
                                        <article key={item.id} className={`rounded-xl border p-3 ${toneClasses(item.tone)}`}>
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{item.kind}</p>
                                                <span className="text-[11px] uppercase tracking-[0.16em] opacity-70">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.at))}</span>
                                            </div>
                                            <p className="mt-2 text-sm font-semibold">{item.title}</p>
                                            <p className="mt-1 text-sm leading-6 opacity-85">{item.detail}</p>
                                        </article>
                                    )) : (
                                        <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-slate-400">
                                            Sem atividade comercial relevante ligada a esta conversa ainda.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-slate-400">
                            Conversa ainda sem vinculo comercial completo. O inbox continua leve e o CRM canonico segue sendo a fonte central do record.
                        </div>
                    )}

                    {commercialNotice ? (
                        <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses(commercialNotice.tone === "critical" ? "critical" : commercialNotice.tone === "warning" ? "warning" : "positive")}`}>
                            {commercialNotice.message}
                        </div>
                    ) : null}
                </>
            ) : null}

            <div className="h-px bg-white/5" />

            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Etiquetas</h4>
                    <span className="text-[10px] text-white/30 uppercase tracking-widest">Somente leitura</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {parsedTags.length > 0 ? parsedTags.map((tag) => (
                        <span key={tag} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/60">
                            {tag}
                        </span>
                    )) : (
                        <span className="text-[10px] text-white/20 italic">Nenhuma etiqueta definida</span>
                    )}
                </div>
            </div>

            <div className="mt-auto flex flex-col gap-2">
                <button
                    onClick={() => onConversationAction?.(conversationStatus === "open" ? "close" : "reopen")}
                    disabled={Boolean(actionLoading) || (conversationStatus !== "open" && isBlockedContact)}
                    className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs font-bold text-white/80 uppercase tracking-widest disabled:opacity-50"
                >
                    {conversationStatus === "open"
                        ? actionLoading === "close" ? "Fechando..." : "Fechar conversa"
                        : actionLoading === "reopen" ? "Reabrindo..." : "Reabrir conversa"}
                </button>

                <button
                    onClick={() => onConversationAction?.("block_contact")}
                    disabled={Boolean(actionLoading) || isBlockedContact}
                    className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
                >
                    {isBlockedContact ? "Contato bloqueado" : actionLoading === "block_contact" ? "Bloqueando..." : "Bloquear contato"}
                </button>

                {actionError ? (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] text-red-300">
                        {actionError}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
