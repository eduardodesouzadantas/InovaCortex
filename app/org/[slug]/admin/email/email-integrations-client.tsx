"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    AlertTriangle,
    CheckCircle2,
    Mail,
    RotateCw,
    ShieldCheck,
    Slash,
} from "lucide-react";
import {
    getEmailOAuthProviderLabel,
    type EmailIntegrationView,
    type EmailOAuthProvider,
} from "@/lib/integrations/email-oauth-types";

type ProviderAvailability = Record<EmailOAuthProvider, boolean>;

type Props = {
    orgSlug: string;
    initialIntegration: EmailIntegrationView | null;
    providerAvailability: ProviderAvailability;
    onAuthorizationUrl?: (url: string) => void;
};

function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function formatDurationMs(value: number | null | undefined): string {
    if (typeof value !== "number" || Number.isNaN(value)) return "—";
    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}s`;
    }
    return `${value}ms`;
}

function getIntegrationStatusLabel(status: string): string {
    if (status === "connected") return "Conectado";
    if (status === "disconnected") return "Desconectado";
    if (status === "connecting") return "Conectando";
    if (status === "error") return "Erro de autenticação";
    return status;
}

function getSyncStatusLabel(status: string | null | undefined): string {
    if (!status) return "Sem histórico";
    if (status === "running") return "Em andamento";
    if (status === "success") return "Sincronizado";
    if (status === "failed") return "Falha";
    if (status === "skipped") return "Ignorado";
    return status;
}

function getSyncStatusTone(status: string | null | undefined): string {
    if (status === "success") return "bg-emerald-400/10 text-emerald-300";
    if (status === "running") return "bg-sky-400/10 text-sky-300";
    if (status === "failed") return "bg-rose-400/10 text-rose-300";
    if (status === "skipped") return "bg-amber-400/10 text-amber-200";
    return "bg-slate-400/10 text-slate-300";
}

export function EmailIntegrationsClient({
    orgSlug,
    initialIntegration,
    providerAvailability,
    onAuthorizationUrl,
}: Props) {
    const router = useRouter();
    const [connectingProvider, setConnectingProvider] = useState<EmailOAuthProvider | null>(null);
    const [disconnecting, setDisconnecting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [integration, setIntegration] = useState(initialIntegration);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const lastRevalidateAtRef = useRef(0);

    const isConnected = integration?.status === "connected";
    const isDisconnected = !integration || integration.status === "disconnected";
    const canManualRefresh = isConnected && integration?.provider === "google";

    useEffect(() => {
        setIntegration(initialIntegration);
    }, [initialIntegration]);

    useEffect(() => {
        if (!isConnected) {
            return;
        }

        const triggerRevalidate = () => {
            if (refreshing || disconnecting || connectingProvider !== null) {
                return;
            }

            const now = Date.now();
            if (now - lastRevalidateAtRef.current < 60_000) {
                return;
            }

            lastRevalidateAtRef.current = now;
            router.refresh();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                triggerRevalidate();
            }
        };

        window.addEventListener("focus", triggerRevalidate);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("focus", triggerRevalidate);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [router, isConnected, refreshing, disconnecting, connectingProvider]);

    const handleConnect = async (provider: EmailOAuthProvider) => {
        setConnectingProvider(provider);
        setErrorMessage(null);

        try {
            const response = await fetch(`/api/org/${orgSlug}/email/connect`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ provider }),
            });

            const payload = await response.json().catch(() => null);
            const authorizationUrl = payload?.data?.authorizationUrl ?? payload?.authorizationUrl;

            if (!response.ok || !authorizationUrl) {
                throw new Error(payload?.error ?? "Não foi possível iniciar o OAuth de email.");
            }

            const navigate = onAuthorizationUrl ?? ((url: string) => window.location.assign(url));
            navigate(authorizationUrl);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Falha ao iniciar conexão.");
        } finally {
            setConnectingProvider(null);
        }
    };

    const handleDisconnect = async () => {
        setDisconnecting(true);
        setErrorMessage(null);

        try {
            const response = await fetch(`/api/org/${orgSlug}/email/disconnect`, {
                method: "POST",
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(payload?.error ?? "Não foi possível desconectar o email.");
            }

            const nextIntegration = payload?.data?.integration ?? null;
            setIntegration(nextIntegration);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Falha ao desconectar.");
        } finally {
            setDisconnecting(false);
        }
    };

    const handleRefresh = async () => {
        if (!canManualRefresh || refreshing) return;

        const previousIntegration = integration;
        setRefreshing(true);
        setErrorMessage(null);
        setIntegration((current) => (current ? { ...current, lastSyncStatus: "running" } : current));

        try {
            const response = await fetch(`/api/org/${orgSlug}/email/refresh`, {
                method: "POST",
            });
            const payload = await response.json().catch(() => null);
            const nextIntegration = payload?.data?.integration ?? previousIntegration;

            if (nextIntegration) {
                setIntegration(nextIntegration);
            }

            if (!response.ok) {
                setErrorMessage(payload?.message ?? payload?.error ?? "Não foi possível atualizar o inbox.");
                return;
            }
        } catch (error) {
            setIntegration(previousIntegration);
            setErrorMessage(error instanceof Error ? error.message : "Falha ao atualizar o inbox.");
        } finally {
            setRefreshing(false);
        }
    };

    const providerLabel = integration?.provider ? getEmailOAuthProviderLabel(integration.provider) : null;
    const lastUpdated = integration ? formatDate(integration.lastSyncAt ?? integration.updatedAt) : "—";
    const syncStatusLabel = getSyncStatusLabel(integration?.lastSyncStatus);
    const syncDurationLabel = formatDurationMs(integration?.lastSyncDurationMs);

    return (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-8 shadow-sm">
            <div className="mb-6 flex items-start gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
                    <Mail className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight text-white">
                        {isConnected ? "Inbox Integrada" : "Inbox Offline"}
                    </h2>
                    <p className="text-sm text-slate-400">
                        {isConnected
                            ? `Conta vinculada: ${integration.ownerEmail}`
                            : integration?.ownerEmail
                                ? `Última conta vinculada: ${integration.ownerEmail}`
                                : "Nenhuma conta de email conectada à workspace."}
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
                <div className="rounded-[24px] border border-white/5 bg-black/10 p-6">
                    <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold text-white">Estado da integração</p>
                            <p className="mt-1 text-xs text-slate-400">
                                {isConnected
                                    ? "OAuth real armazenado com credenciais criptografadas. O sync automático continua rodando em segundo plano; atualizar agora só complementa a operação."
                                    : "A conexão é iniciada pelo backend e só se torna real após o callback OAuth."}
                            </p>
                        </div>

                        <span
                            className={[
                                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider",
                                isConnected
                                    ? "bg-emerald-400/10 text-emerald-300"
                                    : integration?.status === "error"
                                        ? "bg-rose-400/10 text-rose-300"
                                        : "bg-slate-400/10 text-slate-300",
                            ].join(" ")}
                        >
                            {isConnected ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : integration?.status === "error" ? (
                                <AlertTriangle className="h-3.5 w-3.5" />
                            ) : (
                                <Slash className="h-3.5 w-3.5" />
                            )}
                            {getIntegrationStatusLabel(integration?.status ?? "disconnected")}
                        </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                            <p className="mb-1 text-xs uppercase tracking-wider text-slate-400">Provider</p>
                            <p className="text-sm font-semibold text-white">
                                {providerLabel ?? "Nenhum provider vinculado"}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                            <p className="mb-1 text-xs uppercase tracking-wider text-slate-400">Última atualização</p>
                            <p className="text-sm font-semibold text-white">{lastUpdated}</p>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                            <p className="mb-1 text-xs uppercase tracking-wider text-slate-400">Status do sync</p>
                            <div
                                className={[
                                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                                    getSyncStatusTone(integration?.lastSyncStatus),
                                ].join(" ")}
                            >
                                {syncStatusLabel}
                            </div>
                            <p className="mt-2 text-xs text-slate-400">
                                Duração: <span className="font-semibold text-white">{syncDurationLabel}</span>
                            </p>
                        </div>
                    </div>

                    {integration?.lastError ? (
                        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm leading-6 text-rose-300">
                            {integration.lastError}
                        </div>
                    ) : null}

                    {errorMessage ? (
                        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-200">
                            {errorMessage}
                        </div>
                    ) : null}
                </div>

                <div className="rounded-[24px] border border-white/5 bg-black/10 p-6">
                    <p className="mb-4 text-sm font-semibold text-white">Ações</p>

                    {isDisconnected ? (
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => handleConnect("google")}
                                disabled={connectingProvider !== null || !providerAvailability.google}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold tracking-wide text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {connectingProvider === "google" ? (
                                    <RotateCw className="h-5 w-5 animate-spin" />
                                ) : (
                                    <ShieldCheck className="h-5 w-5" />
                                )}
                                {providerAvailability.google ? "Conectar Google Workspace" : "Google indisponível"}
                            </button>

                            <button
                                type="button"
                                onClick={() => handleConnect("microsoft")}
                                disabled={connectingProvider !== null || !providerAvailability.microsoft}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {connectingProvider === "microsoft" ? (
                                    <RotateCw className="h-5 w-5 animate-spin" />
                                ) : (
                                    <ShieldCheck className="h-5 w-5" />
                                )}
                                {providerAvailability.microsoft ? "Conectar Outlook / M365" : "Outlook em breve"}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {canManualRefresh ? (
                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    disabled={refreshing || disconnecting}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-5 py-3 text-sm font-semibold tracking-wide text-sky-200 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {refreshing ? (
                                        <RotateCw className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <RotateCw className="h-5 w-5" />
                                    )}
                                    Atualizar agora
                                </button>
                            ) : (
                                <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-xs leading-6 text-slate-400">
                                    Refresh manual disponível apenas para Google nesta fase. Ele complementa o sync agendado e não representa realtime.
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleDisconnect}
                                disabled={disconnecting || refreshing}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-3 text-sm font-semibold tracking-wide text-rose-300 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {disconnecting ? (
                                    <RotateCw className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Slash className="h-5 w-5" />
                                )}
                                Desconectar Inbox
                            </button>

                            <p className="text-xs leading-6 text-slate-400">
                                O disconnect limpa os tokens locais e invalida a sessão OAuth sempre que o provider permite revogação.
                            </p>
                            <p className="text-xs leading-6 text-slate-500">
                                O refresh manual complementa o sync automático agendado. Não há realtime nesta etapa.
                            </p>
                            <p className="text-xs leading-6 text-slate-500">
                                Ao voltar o foco para esta tela, o painel pode se revalidar de forma leve para refletir atualizações recentes.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
