"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Gauge, Inbox, Loader2, MessageSquareText, PencilLine, ShieldCheck, Siren, Zap } from "lucide-react";

import { ExecutivePulsePanel } from "@/app/org/[slug]/executive/_components/executive-pulse-panel";
import type { MobileCommandSurfaceModel, MobileInboxItem } from "@/lib/mobile/mobile-surface";

type MobileTab = "pulse" | "summary" | "inbox" | "actions";

const TAB_ITEMS: Array<{
    id: MobileTab;
    label: string;
    icon: typeof Siren;
}> = [
    { id: "pulse", label: "Pulse", icon: Siren },
    { id: "summary", label: "Resumo", icon: Gauge },
    { id: "inbox", label: "Inbox", icon: Inbox },
    { id: "actions", label: "Ações", icon: Zap },
];

function formatDateTime(value: string | null): string {
    if (!value) {
        return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date);
}

function formatChannelLabel(channel: MobileInboxItem["channel"]): string {
    return channel === "whatsapp" ? "WhatsApp" : "Email";
}

function formatCurrency(value: number | null): string {
    if (typeof value !== "number") {
        return "Sem valor";
    }

    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
    }).format(value);
}

function InboxCard({
    item,
    selected,
    onSelect,
}: {
    item: MobileInboxItem;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full rounded-2xl border p-4 text-left transition ${
                selected
                    ? "border-cyan-300/30 bg-cyan-300/10"
                    : "border-white/8 bg-white/[0.04] hover:border-white/12 hover:bg-white/[0.06]"
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {formatChannelLabel(item.channel)} · {item.status}
                    </p>
                    <h4 className="mt-2 truncate text-base font-semibold text-white">{item.title}</h4>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    {item.unreadCount}
                </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{item.preview}</p>
            <div className="mt-4 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <span>{item.replyHint}</span>
                <span>{formatDateTime(item.lastMessageAt)}</span>
            </div>
        </button>
    );
}

function SummaryCard({
    title,
    value,
    detail,
}: {
    title: string;
    value: string;
    detail: string;
}) {
    return (
        <article className="rounded-3xl border border-white/8 bg-white/[0.04] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
        </article>
    );
}

export function MobileCommandSurfaceClient({
    slug,
    data,
}: {
    slug: string;
    data: MobileCommandSurfaceModel;
}) {
    const [tab, setTab] = useState<MobileTab>("pulse");
    const [inboxItems, setInboxItems] = useState(data.inboxItems);
    const [deals, setDeals] = useState(data.recentDeals);
    const [selectedInboxId, setSelectedInboxId] = useState(data.inboxItems[0]?.id ?? null);
    const [selectedDealId, setSelectedDealId] = useState(data.recentDeals[0]?.id ?? null);
    const [draftText, setDraftText] = useState("");
    const [noteDraft, setNoteDraft] = useState("");
    const [statusDraft, setStatusDraft] = useState("open");
    const [activeActionId, setActiveActionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const selectedInbox = useMemo(
        () => inboxItems.find((item) => item.id === selectedInboxId) ?? null,
        [inboxItems, selectedInboxId],
    );
    const selectedDeal = useMemo(
        () => deals.find((deal) => deal.id === selectedDealId) ?? null,
        [deals, selectedDealId],
    );

    useEffect(() => {
        if (selectedDeal) {
            setStatusDraft(selectedDeal.status);
        }
    }, [selectedDeal]);

    async function submitWhatsAppReply() {
        if (!selectedInbox || selectedInbox.channel !== "whatsapp" || !selectedInbox.conversationId || !draftText.trim()) {
            return;
        }

        setActiveActionId(selectedInbox.id);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/org/${slug}/whatsapp/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    conversationId: selectedInbox.conversationId,
                    text: draftText.trim(),
                    type: "text",
                }),
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(payload?.message ?? payload?.error ?? "Nao foi possivel enviar a resposta.");
            }

            setInboxItems((current) => current.map((item) => item.id === selectedInbox.id
                ? {
                    ...item,
                    preview: draftText.trim(),
                    lastMessageAt: new Date().toISOString(),
                }
                : item));
            setDraftText("");
            setSuccess("Resposta enviada no WhatsApp.");
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : "Falha ao enviar a resposta.");
        } finally {
            setActiveActionId(null);
        }
    }

    async function submitEmailFollowUp() {
        if (!selectedInbox || selectedInbox.channel !== "email" || !selectedInbox.threadId || !draftText.trim()) {
            return;
        }

        setActiveActionId(selectedInbox.id);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/org/${slug}/mobile/actions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kind: "activity_create",
                    threadId: selectedInbox.threadId,
                    type: "email_follow_up",
                    note: draftText.trim(),
                }),
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(payload?.message ?? payload?.error ?? "Nao foi possivel registrar o follow-up.");
            }

            setDraftText("");
            setSuccess("Follow-up registrado para o email.");
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : "Falha ao registrar o follow-up.");
        } finally {
            setActiveActionId(null);
        }
    }

    async function updateDeal(status: string) {
        if (!selectedDeal) {
            return;
        }

        setActiveActionId(`deal:${selectedDeal.id}:${status}`);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/org/${slug}/mobile/actions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kind: "deal_update",
                    dealId: selectedDeal.id,
                    status,
                    note: noteDraft.trim() || null,
                }),
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(payload?.message ?? payload?.error ?? "Nao foi possivel atualizar o deal.");
            }

            setDeals((current) => current.map((item) => item.id === selectedDeal.id ? { ...item, status } : item));
            setStatusDraft(status);
            setNoteDraft("");
            setSuccess("Deal atualizado.");
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : "Falha ao atualizar o deal.");
        } finally {
            setActiveActionId(null);
        }
    }

    const inboxCounts = useMemo(() => {
        return inboxItems.reduce((accumulator, item) => {
            accumulator[item.channel] += 1;
            return accumulator;
        }, { whatsapp: 0, email: 0 });
    }, [inboxItems]);

    return (
        <div className="min-h-dvh bg-[#050816] text-white">
            <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-28 pt-4">
                <header className="rounded-[32px] border border-white/8 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Mobile Command Surface</p>
                            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{data.org.name}</h1>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                                Decisao rapida, acao imediata e sem dashboard pesado.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                        <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">Plano {data.org.plan}</span>
                        <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">Atualizado {formatDateTime(data.generatedAt)}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
                        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Inbox</p>
                            <p className="mt-2 text-lg font-semibold text-white">{inboxCounts.whatsapp + inboxCounts.email}</p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Pulse</p>
                            <p className="mt-2 text-lg font-semibold text-white">{data.prioritizedAlerts.length}</p>
                        </div>
                    </div>
                </header>

                <div className="mt-4 flex flex-1 flex-col gap-4">
                    {success ? (
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                            {success}
                        </div>
                    ) : null}
                    {error ? (
                        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                            {error}
                        </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2 rounded-3xl border border-white/8 bg-white/[0.03] p-2">
                        {TAB_ITEMS.map((item) => {
                            const isActive = item.id === tab;
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        setTab(item.id);
                                        setError(null);
                                        setSuccess(null);
                                    }}
                                    className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                                        isActive
                                            ? "bg-cyan-300/15 text-cyan-100"
                                            : "text-slate-300 hover:bg-white/5"
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex-1 space-y-4">
                        {tab === "pulse" ? (
                            <div className="rounded-[32px] border border-white/8 bg-white/[0.04] p-4">
                                <ExecutivePulsePanel orgSlug={slug} alerts={data.prioritizedAlerts} />
                            </div>
                        ) : null}

                        {tab === "summary" ? (
                            <div className="space-y-4">
                                <div className="rounded-[32px] border border-white/8 bg-white/[0.04] p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Leitura rapida</p>
                                    <h2 className="mt-2 text-xl font-semibold tracking-tight">{data.overview.headline}</h2>
                                    <p className="mt-2 text-sm leading-6 text-slate-300">{data.decisionNarrative.summary}</p>
                                </div>
                                <div className="grid gap-3">
                                    {data.summaryCards.map((card) => (
                                        <SummaryCard
                                            key={card.id}
                                            title={card.title}
                                            value={card.value}
                                            detail={card.detail}
                                        />
                                    ))}
                                </div>
                                <div className="rounded-[32px] border border-white/8 bg-white/[0.04] p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Foco agora</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {data.decisionNarrative.focusNow.map((item) => (
                                            <span key={item} className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {tab === "inbox" ? (
                            <div className="space-y-4">
                                <div className="rounded-[32px] border border-white/8 bg-white/[0.04] p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Inbox</p>
                                            <h2 className="mt-2 text-xl font-semibold tracking-tight">WhatsApp + Email</h2>
                                        </div>
                                        <MessageSquareText className="h-5 w-5 text-cyan-200" />
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-slate-300">
                                        WhatsApp envia de verdade. Email registra follow-up e mantem a fila clara.
                                    </p>
                                </div>

                                <div className="grid gap-3">
                                    {inboxItems.map((item) => (
                                        <InboxCard
                                            key={item.id}
                                            item={item}
                                            selected={item.id === selectedInboxId}
                                            onSelect={() => setSelectedInboxId(item.id)}
                                        />
                                    ))}
                                </div>

                                {selectedInbox ? (
                                    <div className="rounded-[32px] border border-white/8 bg-white/[0.04] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                                    {formatChannelLabel(selectedInbox.channel)}
                                                </p>
                                                <h3 className="mt-2 text-lg font-semibold tracking-tight">{selectedInbox.title}</h3>
                                            </div>
                                            <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                                                {selectedInbox.status}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-sm leading-6 text-slate-300">{selectedInbox.preview}</p>
                                        <textarea
                                            value={draftText}
                                            onChange={(event) => setDraftText(event.target.value)}
                                            placeholder={selectedInbox.channel === "whatsapp" ? "Digite a resposta curta..." : "Digite o follow-up do email..."}
                                            className="mt-4 min-h-28 w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/30"
                                        />
                                        <button
                                            type="button"
                                            onClick={selectedInbox.channel === "whatsapp" ? submitWhatsAppReply : submitEmailFollowUp}
                                            disabled={activeActionId === selectedInbox.id || !draftText.trim()}
                                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {activeActionId === selectedInbox.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                                            {selectedInbox.channel === "whatsapp" ? "Enviar resposta" : "Registrar follow-up"}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        {tab === "actions" ? (
                            <div className="space-y-4">
                                <div className="rounded-[32px] border border-white/8 bg-white/[0.04] p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Quick Actions</p>
                                            <h2 className="mt-2 text-xl font-semibold tracking-tight">Deals em foco</h2>
                                        </div>
                                        <PencilLine className="h-5 w-5 text-amber-200" />
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-slate-300">
                                        Atualize o deal e registre atividade sem sair da tela.
                                    </p>
                                </div>

                                <div className="grid gap-3">
                                    {deals.map((deal) => (
                                        <button
                                            key={deal.id}
                                            type="button"
                                            onClick={() => setSelectedDealId(deal.id)}
                                            className={`rounded-[28px] border p-4 text-left transition ${
                                                selectedDealId === deal.id
                                                    ? "border-amber-300/30 bg-amber-300/10"
                                                    : "border-white/8 bg-white/[0.04] hover:border-white/12"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                                        {deal.status} · {deal.stage.name}
                                                    </p>
                                                    <h3 className="mt-2 text-base font-semibold text-white">{deal.contact.name ?? deal.contact.email ?? "Contato sem nome"}</h3>
                                                </div>
                                                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                                                    {formatCurrency(deal.value)}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {selectedDeal ? (
                                    <div className="rounded-[32px] border border-white/8 bg-white/[0.04] p-4">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Deal selecionado</p>
                                        <h3 className="mt-2 text-lg font-semibold tracking-tight">{selectedDeal.contact.name ?? selectedDeal.contact.email ?? "Contato sem nome"}</h3>
                                        <p className="mt-1 text-sm text-slate-300">
                                            {selectedDeal.stage.name} · {selectedDeal.status}
                                        </p>

                                        <div className="mt-4 grid grid-cols-3 gap-2">
                                            {[
                                                { label: "Acompanhar", value: "open" },
                                                { label: "Ganho", value: "closed_won" },
                                                { label: "Perdido", value: "closed_lost" },
                                            ].map((item) => (
                                                <button
                                                    key={item.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setStatusDraft(item.value);
                                                        void updateDeal(item.value);
                                                    }}
                                                    disabled={activeActionId === `deal:${selectedDeal.id}:${item.value}`}
                                                    className={`rounded-2xl border px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                                                        statusDraft === item.value
                                                            ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100"
                                                            : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.06]"
                                                    }`}
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>

                                        <textarea
                                            value={noteDraft}
                                            onChange={(event) => setNoteDraft(event.target.value)}
                                            placeholder="Registrar atividade simples..."
                                            className="mt-4 min-h-24 w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/30"
                                        />

                                        <button
                                            type="button"
                                            onClick={() => void updateDeal(statusDraft)}
                                            disabled={activeActionId === `deal:${selectedDeal.id}:${statusDraft}`}
                                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {activeActionId === `deal:${selectedDeal.id}:${statusDraft}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                                            Salvar
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/8 bg-[#050816]/90 px-4 pb-5 pt-3 backdrop-blur-xl">
                <div className="mx-auto grid max-w-[480px] grid-cols-4 gap-2">
                    {TAB_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const active = item.id === tab;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setTab(item.id)}
                                className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                                    active
                                        ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
                                        : "border-white/8 bg-white/[0.04] text-slate-400"
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
