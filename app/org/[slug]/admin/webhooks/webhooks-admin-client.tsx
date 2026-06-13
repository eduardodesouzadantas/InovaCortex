"use client";

import { useState } from "react";
import { Copy, ExternalLink, Plus, RefreshCcw, RotateCw, Shield, ShieldCheck, Trash2 } from "lucide-react";

import type { WebhookEndpointView } from "@/lib/public-api/webhooks";
import type { WebhookEventType } from "@/lib/public-api/webhook-events";

type Props = {
    orgSlug: string;
    initialWebhooks: WebhookEndpointView[];
    supportedEvents: WebhookEventType[];
};

type Draft = {
    url: string;
    isActive: boolean;
    subscribedEvents: WebhookEventType[];
};

type Banner = { tone: "success" | "error"; message: string } | null;
type SecretBanner = { kind: "created" | "rotated"; webhookUrl: string; secret: string } | null;

const EVENT_LABELS: Record<WebhookEventType, string> = {
    "contact.created": "Contato criado",
    "deal.created": "Deal criado",
    "deal.updated": "Deal atualizado",
    "activity.created": "Activity criada",
    "message.received": "Mensagem recebida",
};

function normalizeEvents(events: WebhookEventType[]): WebhookEventType[] {
    return [...new Set(events)];
}

function createDraft(supportedEvents: WebhookEventType[]): Draft {
    return { url: "", isActive: true, subscribedEvents: normalizeEvents(supportedEvents) };
}

function safeMessage(payload: unknown, fallback: string): string {
    if (payload && typeof payload === "object") {
        const record = payload as Record<string, unknown>;
        if (typeof record.message === "string" && record.message.trim()) return record.message;
        if (typeof record.error === "string" && record.error.trim()) return record.error;
    }
    return fallback;
}

function statusTone(status: string | null | undefined): string {
    if (status === "delivered") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
    if (status === "failed") return "border-rose-400/20 bg-rose-400/10 text-rose-100";
    if (status === "pending") return "border-amber-400/20 bg-amber-400/10 text-amber-100";
    return "border-white/10 bg-white/[0.03] text-slate-300";
}

function statusLabel(status: string | null | undefined): string {
    if (!status) return "Sem historico";
    if (status === "delivered") return "Entregue";
    if (status === "failed") return "Falhou";
    if (status === "pending") return "Pendente";
    return status;
}

function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "—"
        : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function WebhookAdminClient({ orgSlug, initialWebhooks, supportedEvents }: Props) {
    const [webhooks, setWebhooks] = useState(initialWebhooks);
    const [draft, setDraft] = useState<Draft>(() => createDraft(supportedEvents));
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [banner, setBanner] = useState<Banner>(null);
    const [secretBanner, setSecretBanner] = useState<SecretBanner>(null);

    const toggleEvent = (events: WebhookEventType[], event: WebhookEventType) => (
        events.includes(event)
            ? events.filter((value) => value !== event)
            : [...events, event]
    );

    const updateWebhook = (webhookId: string, patch: Partial<WebhookEndpointView>) => {
        setWebhooks((current) => current.map((item) => (
            item.id === webhookId ? { ...item, ...patch } : item
        )));
    };

    const upsertWebhook = (webhook: WebhookEndpointView) => {
        setWebhooks((current) => [webhook, ...current.filter((item) => item.id !== webhook.id)]);
    };

    const createWebhook = async () => {
        if (busyKey) return;
        if (!draft.url.trim() || draft.subscribedEvents.length === 0) {
            setBanner({ tone: "error", message: "Informe uma URL valida e selecione ao menos um evento." });
            return;
        }

        setBusyKey("create");
        setBanner(null);
        setSecretBanner(null);

        try {
            const response = await fetch(`/api/org/${orgSlug}/webhooks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.webhook) {
                throw new Error(safeMessage(payload, "Nao foi possivel criar o webhook."));
            }

            const webhook = payload.webhook as WebhookEndpointView;
            upsertWebhook(webhook);
            setDraft(createDraft(supportedEvents));
            setSecretBanner({
                kind: "created",
                webhookUrl: webhook.url,
                secret: String(payload.secret ?? ""),
            });
            setBanner({ tone: "success", message: "Webhook criado com sucesso." });
        } catch (error) {
            setBanner({
                tone: "error",
                message: error instanceof Error ? error.message : "Nao foi possivel criar o webhook.",
            });
        } finally {
            setBusyKey(null);
        }
    };

    const saveWebhook = async (webhook: WebhookEndpointView) => {
        if (busyKey) return;
        if (!webhook.url.trim() || webhook.subscribedEvents.length === 0) {
            setBanner({ tone: "error", message: "Informe uma URL valida e mantenha ao menos um evento." });
            return;
        }

        setBusyKey(`save:${webhook.id}`);
        setBanner(null);
        setSecretBanner(null);

        try {
            const response = await fetch(`/api/org/${orgSlug}/webhooks/${webhook.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: webhook.url,
                    isActive: webhook.isActive,
                    subscribedEvents: webhook.subscribedEvents,
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.webhook) {
                throw new Error(safeMessage(payload, "Nao foi possivel salvar o webhook."));
            }

            const nextWebhook = payload.webhook as WebhookEndpointView;
            upsertWebhook(nextWebhook);
            if (payload.secret) {
                setSecretBanner({
                    kind: "rotated",
                    webhookUrl: nextWebhook.url,
                    secret: String(payload.secret),
                });
            }
            setBanner({ tone: "success", message: "Webhook atualizado." });
        } catch (error) {
            setBanner({
                tone: "error",
                message: error instanceof Error ? error.message : "Nao foi possivel salvar o webhook.",
            });
        } finally {
            setBusyKey(null);
        }
    };

    const rotateSecret = async (webhookId: string) => {
        if (busyKey) return;
        setBusyKey(`rotate:${webhookId}`);
        setBanner(null);
        setSecretBanner(null);

        try {
            const response = await fetch(`/api/org/${orgSlug}/webhooks/${webhookId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rotateSecret: true }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.webhook) {
                throw new Error(safeMessage(payload, "Nao foi possivel rotacionar o segredo."));
            }

            const nextWebhook = payload.webhook as WebhookEndpointView;
            upsertWebhook(nextWebhook);
            setSecretBanner({
                kind: "rotated",
                webhookUrl: nextWebhook.url,
                secret: String(payload.secret ?? ""),
            });
            setBanner({ tone: "success", message: "Segredo rotacionado. Copie o novo valor agora." });
        } catch (error) {
            setBanner({
                tone: "error",
                message: error instanceof Error ? error.message : "Nao foi possivel rotacionar o segredo.",
            });
        } finally {
            setBusyKey(null);
        }
    };

    const deleteWebhook = async (webhookId: string) => {
        if (busyKey) return;
        if (typeof window !== "undefined" && !window.confirm("Remover este webhook?")) return;

        setBusyKey(`delete:${webhookId}`);
        setBanner(null);
        setSecretBanner(null);

        try {
            const response = await fetch(`/api/org/${orgSlug}/webhooks/${webhookId}`, { method: "DELETE" });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(safeMessage(payload, "Nao foi possivel remover o webhook."));
            }

            setWebhooks((current) => current.filter((item) => item.id !== webhookId));
            setBanner({ tone: "success", message: "Webhook removido." });
        } catch (error) {
            setBanner({
                tone: "error",
                message: error instanceof Error ? error.message : "Nao foi possivel remover o webhook.",
            });
        } finally {
            setBusyKey(null);
        }
    };

    const copySecret = async (secret: string) => {
        try {
            await navigator.clipboard.writeText(secret);
            setBanner({ tone: "success", message: "Segredo copiado para a area de transferencia." });
        } catch {
            setBanner({ tone: "error", message: "Nao foi possivel copiar o segredo agora." });
        }
    };

    return (
        <div className="space-y-6">
            {banner ? (
                <div className={[
                    "rounded-3xl border p-4 text-sm leading-6",
                    banner.tone === "success"
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                        : "border-rose-400/20 bg-rose-400/10 text-rose-100",
                ].join(" ")}>
                    {banner.message}
                </div>
            ) : null}
            {secretBanner ? (
                <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-amber-100">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">
                                Segredo {secretBanner.kind === "created" ? "gerado" : "rotacionado"}
                            </p>
                            <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
                                Copie agora. Este segredo nao sera exibido novamente.
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-amber-50/80">
                                Endpoint: {secretBanner.webhookUrl}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => copySecret(secretBanner.secret)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-amber-200/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                            >
                                <Copy className="h-4 w-4" />
                                Copiar segredo
                            </button>
                            <button
                                type="button"
                                onClick={() => setSecretBanner(null)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/10 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-black/20"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                    <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-amber-50/90">
                        {secretBanner.secret}
                    </pre>
                </div>
            ) : null}

            <section className="rounded-[32px] border border-white/10 bg-[#07101c] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.18)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Novo endpoint</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Criar webhook por tenant</h2>
                        <p className="mt-3 text-sm leading-6 text-slate-300">
                            A plataforma assina cada entrega, registra tentativas e mantem o segredo fora da tela depois da criacao.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{webhooks.length} endpoints</span>
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-100">
                            {webhooks.filter((item) => item.isActive).length} ativos
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                            {webhooks.filter((item) => !item.isActive).length} inativos
                        </span>
                    </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-4">
                        <label className="block">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">URL de destino</span>
                            <input
                                value={draft.url}
                                onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
                                placeholder="https://partner.example.com/webhooks/inovacortex"
                                aria-label="URL de destino"
                                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
                            />
                        </label>

                        <div>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Eventos inscritos</span>
                                <button
                                    type="button"
                                    onClick={() => setDraft((current) => ({ ...current, subscribedEvents: [...supportedEvents] }))}
                                    className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100"
                                >
                                    Selecionar todos
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {supportedEvents.map((event) => (
                                    <button
                                        key={event}
                                        type="button"
                                        onClick={() => setDraft((current) => ({
                                            ...current,
                                            subscribedEvents: toggleEvent(current.subscribedEvents, event),
                                        }))}
                                        className={[
                                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                                            draft.subscribedEvents.includes(event)
                                                ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                                                : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
                                        ].join(" ")}
                                    >
                                        {EVENT_LABELS[event] ?? event}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-[28px] border border-white/8 bg-black/15 p-5">
                        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-slate-100">
                            <input
                                type="checkbox"
                                checked={draft.isActive}
                                onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
                                className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-400 focus:ring-cyan-400"
                            />
                            Endpoint ativo ao criar
                        </label>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-slate-400">
                            <p className="font-semibold text-slate-200">Contrato operacional</p>
                            <p className="mt-2">
                                Active controla entrega. O segredo novo aparece uma unica vez. Eventos determinam o que sera entregue.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={createWebhook}
                            disabled={busyKey !== null || !draft.url.trim() || draft.subscribedEvents.length === 0}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {busyKey === "create" ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Criar endpoint
                        </button>
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Endpoints cadastrados</p>
                        <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">Gerencie URLs, eventos e segredos</h3>
                    </div>
                    <p className="text-sm leading-6 text-slate-400">
                        Cada card mostra o ultimo status de entrega, o ultimo erro resumido e o numero de tentativas.
                    </p>
                </div>

                {webhooks.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-white/10 bg-black/10 p-8 text-sm leading-6 text-slate-400">
                        Nenhum webhook configurado ainda. Crie o primeiro endpoint acima para receber eventos assinados da plataforma.
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {webhooks.map((webhook) => {
                            const isSaving = busyKey === `save:${webhook.id}`;
                            const isRotating = busyKey === `rotate:${webhook.id}`;
                            const isDeleting = busyKey === `delete:${webhook.id}`;
                            const saveDisabled = busyKey !== null || !webhook.url.trim() || webhook.subscribedEvents.length === 0;

                            return (
                                <article key={webhook.id} className="rounded-[30px] border border-white/10 bg-[#07101c] p-6">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={[
                                                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                                                    webhook.isActive
                                                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                                        : "border-slate-400/20 bg-slate-400/10 text-slate-200",
                                                ].join(" ")}>
                                                    {webhook.isActive ? <ShieldCheck className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                                                    {webhook.isActive ? "Ativo" : "Inativo"}
                                                </span>
                                                <span className={[
                                                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                                                    statusTone(webhook.lastDeliveryStatus),
                                                ].join(" ")}>
                                                    {statusLabel(webhook.lastDeliveryStatus)}
                                                </span>
                                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                                                    {webhook.deliveryAttemptCount} tentativas
                                                </span>
                                            </div>

                                            <div className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                                                <ExternalLink className="h-4 w-4 shrink-0 text-slate-500" />
                                                <a
                                                    href={webhook.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="break-all text-cyan-100 underline-offset-4 transition hover:text-cyan-50 hover:underline"
                                                >
                                                    {webhook.url}
                                                </a>
                                            </div>

                                            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                                                Ultima entrega: <span className="font-semibold text-slate-200">{formatDate(webhook.lastDeliveryAt)}</span>
                                            </p>

                                            {webhook.lastDeliveryError ? (
                                                <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
                                                    {webhook.lastDeliveryError}
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => rotateSecret(webhook.id)}
                                                disabled={busyKey !== null}
                                                className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isRotating ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                                                Rotacionar segredo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deleteWebhook(webhook.id)}
                                                disabled={busyKey !== null}
                                                className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isDeleting ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                Remover
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                                        <div className="space-y-4">
                                            <label className="block">
                                                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">URL</span>
                                                <input
                                                    value={webhook.url}
                                                    onChange={(event) => updateWebhook(webhook.id, { url: event.target.value })}
                                                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
                                                />
                                            </label>

                                            <div>
                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Eventos inscritos</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateWebhook(webhook.id, { subscribedEvents: [...supportedEvents] })}
                                                        className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100"
                                                    >
                                                        Todos
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {supportedEvents.map((event) => (
                                                        <button
                                                            key={event}
                                                            type="button"
                                                            onClick={() => updateWebhook(webhook.id, {
                                                                subscribedEvents: toggleEvent(webhook.subscribedEvents, event),
                                                            })}
                                                            className={[
                                                                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                                                                webhook.subscribedEvents.includes(event)
                                                                    ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                                                                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
                                                            ].join(" ")}
                                                        >
                                                            {EVENT_LABELS[event] ?? event}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 rounded-[28px] border border-white/8 bg-black/15 p-5">
                                            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-slate-100">
                                                <input
                                                    type="checkbox"
                                                    checked={webhook.isActive}
                                                    onChange={(event) => updateWebhook(webhook.id, { isActive: event.target.checked })}
                                                    className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-400 focus:ring-cyan-400"
                                                />
                                                Ativo
                                            </label>

                                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-slate-400">
                                                <p className="font-semibold text-slate-200">Operacao do endpoint</p>
                                                <p className="mt-2">
                                                    Atualize a URL, os eventos inscritos ou o status do endpoint sem abrir outra tela.
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => saveWebhook(webhook)}
                                                disabled={saveDisabled}
                                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isSaving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                                Salvar alteracoes
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
