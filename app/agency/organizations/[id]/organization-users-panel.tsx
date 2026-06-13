"use client";

import { useState, type FormEvent } from "react";

import type { OrganizationInviteRecord } from "@/lib/repositories/organizationRepository";
import type { OrganizationUserRecord } from "@/lib/repositories/organizationUserRepository";

const INVITE_ROLE_OPTIONS = ["owner", "admin", "closer", "viewer"] as const;

function formatDate(value: string): string {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function getStatusTone(active: boolean): string {
    return active
        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
        : "border-rose-400/20 bg-rose-400/10 text-rose-100";
}

function getInviteTone(status: OrganizationInviteRecord["status"]): string {
    if (status === "accepted") {
        return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
    }
    if (status === "expired" || status === "revoked") {
        return "border-rose-400/20 bg-rose-400/10 text-rose-100";
    }
    return "border-cyan-400/20 bg-cyan-400/10 text-cyan-100";
}

function getInviteStatusLabel(status: OrganizationInviteRecord["status"]): string {
    switch (status) {
        case "accepted":
            return "Aceito";
        case "expired":
            return "Expirado";
        case "revoked":
            return "Revogado";
        default:
            return "Pendente";
    }
}

function buildInviteLabel(role: string): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
}

export function OrganizationUsersPanel({
    organizationId,
    organizationName,
    users,
    invites,
    canManage,
}: {
    organizationId: string;
    organizationName: string;
    users: OrganizationUserRecord[];
    invites: OrganizationInviteRecord[];
    canManage: boolean;
}) {
    const [pendingResetUserId, setPendingResetUserId] = useState<string | null>(null);
    const [resetFeedbackByUserId, setResetFeedbackByUserId] = useState<Record<string, { tone: "success" | "error"; message: string }>>({});
    const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);
    const [inviteFeedback, setInviteFeedback] = useState<{ tone: "success" | "error"; message: string; inviteUrl?: string } | null>(null);
    const [inviteDraft, setInviteDraft] = useState({
        email: "",
        role: "viewer",
    });
    const [inviteItems, setInviteItems] = useState(invites);

    async function handleResetAccess(user: OrganizationUserRecord) {
        const confirmed = window.confirm(`Gerar novo reset de acesso para ${user.email}? O token atual sera invalidado.`);
        if (!confirmed) {
            return;
        }

        setPendingResetUserId(user.id);
        setResetFeedbackByUserId((current) => {
            const next = { ...current };
            delete next[user.id];
            return next;
        });

        try {
            const response = await fetch("/api/auth/reset/request", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    organizationId,
                    userId: user.id,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.success) {
                const message = typeof payload?.error === "string" ? payload.error : "Falha ao gerar reset de acesso.";
                setResetFeedbackByUserId((current) => ({
                    ...current,
                    [user.id]: { tone: "error", message },
                }));
                return;
            }

            setResetFeedbackByUserId((current) => ({
                ...current,
                [user.id]: {
                    tone: "success",
                    message: `Reset de acesso gerado. Expira em ${formatDate(payload.data.expiresAt)}.`,
                },
            }));
        } finally {
            setPendingResetUserId(null);
        }
    }

    async function handleCreateInvite(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!inviteDraft.email.trim()) {
            setInviteFeedback({ tone: "error", message: "Informe o e-mail do convidado." });
            return;
        }

        setInviteFeedback(null);
        setPendingInviteId("create");

        try {
            const response = await fetch("/api/agency/invites/create", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    organizationId,
                    email: inviteDraft.email,
                    role: inviteDraft.role,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.success) {
                const message = typeof payload?.error === "string" ? payload.error : "Falha ao criar convite.";
                setInviteFeedback({ tone: "error", message });
                return;
            }

            const nextInvite = payload.data.invite as OrganizationInviteRecord;
            setInviteItems((current) => [nextInvite, ...current.filter((invite) => invite.id !== nextInvite.id)]);
            setInviteDraft({ email: "", role: "viewer" });
            setInviteFeedback({
                tone: "success",
                message: `Convite criado para ${nextInvite.email}.`,
                inviteUrl: typeof payload.data.inviteUrl === "string" ? payload.data.inviteUrl : undefined,
            });
        } finally {
            setPendingInviteId(null);
        }
    }

    async function handleRevokeInvite(invite: OrganizationInviteRecord) {
        const confirmed = window.confirm(`Revogar o convite para ${invite.email}?`);
        if (!confirmed) {
            return;
        }

        setPendingInviteId(invite.id);
        setInviteFeedback(null);

        try {
            const response = await fetch("/api/agency/invites/revoke", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    organizationId,
                    inviteId: invite.id,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.success) {
                const message = typeof payload?.error === "string" ? payload.error : "Falha ao revogar convite.";
                setInviteFeedback({ tone: "error", message });
                return;
            }

            const updatedInvite = payload.data.invite as OrganizationInviteRecord;
            setInviteItems((current) => current.map((item) => (item.id === updatedInvite.id ? updatedInvite : item)));
            setInviteFeedback({
                tone: "success",
                message: `Convite de ${updatedInvite.email} revogado.`,
            });
        } finally {
            setPendingInviteId(null);
        }
    }

    return (
        <section className="rounded-[30px] border border-white/8 bg-[#0a1624] p-6">
            <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-200">
                    <span className="text-sm font-semibold">U</span>
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Users</p>
                    <h2 className="text-2xl font-semibold tracking-tight">Usuarios da empresa</h2>
                    <p className="mt-1 text-xs text-slate-400">
                        Visibilidade basica do acesso humano vinculado a {organizationName}.
                    </p>
                </div>
            </div>

            {canManage && users.length === 0 ? (
                <form
                    action={`/api/agency/organizations/${organizationId}/users`}
                    method="post"
                    className="mt-6 rounded-[26px] border border-cyan-400/20 bg-cyan-400/5 p-5"
                >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                        Acesso inicial
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                        Crie o primeiro usuario da organizacao para liberar o acesso inicial da empresa.
                    </p>

                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <label className="space-y-2">
                            <span className="block text-sm font-medium text-slate-200">Nome</span>
                            <input
                                type="text"
                                name="name"
                                autoComplete="name"
                                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-black/30"
                                placeholder="Nome completo"
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="block text-sm font-medium text-slate-200">E-mail</span>
                            <input
                                type="email"
                                name="email"
                                required
                                autoComplete="email"
                                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-black/30"
                                placeholder="usuario@empresa.com"
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="block text-sm font-medium text-slate-200">Senha inicial</span>
                            <input
                                type="password"
                                name="password"
                                required
                                minLength={8}
                                autoComplete="new-password"
                                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm tracking-widest text-white outline-none transition focus:border-cyan-300/40 focus:bg-black/30"
                                placeholder="Senha temporaria"
                            />
                        </label>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                            type="submit"
                            className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-400/30 hover:bg-cyan-400/15"
                        >
                            Criar usuario inicial
                        </button>
                        <p className="text-xs text-slate-400">
                            Acesso inicial real com nome opcional e reset de senha seguro.
                        </p>
                    </div>
                </form>
            ) : null}

            {canManage ? (
                <section className="mt-6 rounded-[26px] border border-white/8 bg-black/10 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">Convites</p>
                            <h3 className="mt-1 text-xl font-semibold tracking-tight">Convidar usuario</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                                Gere um convite seguro para entrada controlada na organization.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                            {inviteItems.length} convite(s) rastreados
                        </div>
                    </div>

                    <form className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.7fr_auto]" onSubmit={handleCreateInvite}>
                        <label className="space-y-2">
                            <span className="block text-sm font-medium text-slate-200">E-mail</span>
                            <input
                                type="email"
                                required
                                value={inviteDraft.email}
                                onChange={(event) => setInviteDraft((current) => ({ ...current, email: event.target.value }))}
                                autoComplete="email"
                                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-black/30"
                                placeholder="convidado@empresa.com"
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="block text-sm font-medium text-slate-200">Papel</span>
                            <select
                                value={inviteDraft.role}
                                onChange={(event) => setInviteDraft((current) => ({ ...current, role: event.target.value }))}
                                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-black/30"
                            >
                                {INVITE_ROLE_OPTIONS.map((role) => (
                                    <option key={role} value={role}>
                                        {buildInviteLabel(role)}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="flex items-end">
                            <button
                                type="submit"
                                disabled={pendingInviteId !== null}
                                className="inline-flex h-12 items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 text-sm font-medium text-cyan-100 transition hover:border-cyan-400/30 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {pendingInviteId === "create" ? "Gerando..." : "Convidar usuario"}
                            </button>
                        </div>
                    </form>

                    {inviteFeedback ? (
                        <div
                            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                                inviteFeedback.tone === "success"
                                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                    : "border-rose-400/20 bg-rose-400/10 text-rose-100"
                            }`}
                        >
                            <p>{inviteFeedback.message}</p>
                            {inviteFeedback.inviteUrl ? (
                                <a
                                    href={inviteFeedback.inviteUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex text-cyan-100 underline decoration-cyan-300/40 underline-offset-4"
                                >
                                    Abrir link do convite
                                </a>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="mt-5 space-y-3">
                        {inviteItems.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400">
                                Nenhum convite registrado para esta organization.
                            </div>
                        ) : (
                            inviteItems.map((invite) => (
                                <div key={invite.id} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                                    <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_auto] md:items-start">
                                        <div className="space-y-2">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">E-mail</p>
                                                <p className="mt-1 text-sm font-medium text-white">{invite.email}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                                                <span>{buildInviteLabel(invite.role)}</span>
                                                <span>Created {formatDate(invite.createdAt)}</span>
                                            </div>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Status</p>
                                                <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${getInviteTone(invite.status)}`}>
                                                    {getInviteStatusLabel(invite.status)}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Expira em</p>
                                                <p className="mt-1 text-sm text-slate-200">{formatDate(invite.expiresAt)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Aceito em</p>
                                                <p className="mt-1 text-sm text-slate-200">{invite.acceptedAt ? formatDate(invite.acceptedAt) : "-"}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Revogado em</p>
                                                <p className="mt-1 text-sm text-slate-200">{invite.revokedAt ? formatDate(invite.revokedAt) : "-"}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-start gap-3">
                                            <button
                                                type="button"
                                                disabled={invite.status !== "pending" || pendingInviteId === invite.id}
                                                onClick={() => {
                                                    void handleRevokeInvite(invite);
                                                }}
                                                className="inline-flex items-center rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-100 transition hover:border-rose-400/30 hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {pendingInviteId === invite.id ? "Revogando..." : "Revogar convite"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            ) : null}

            <div className="mt-6 space-y-3">
                {users.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400">
                        Nenhum usuario cadastrado para esta organization.
                    </div>
                ) : (
                    users.map((user) => {
                        const toggleRoute = user.active
                            ? `/api/agency/organizations/${organizationId}/users/${user.id}/deactivate`
                            : `/api/agency/organizations/${organizationId}/users/${user.id}/activate`;
                        const actionLabel = user.active ? "Desativar usuario" : "Ativar usuario";
                        const confirmMessage = user.active
                            ? `Desativar ${user.email}? O acesso ao tenant sera bloqueado ate reativacao.`
                            : null;

                        return (
                            <div key={user.id} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                                <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_auto] md:items-start">
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Nome</p>
                                            <p className="mt-1 font-medium text-white">{user.name ?? "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">E-mail</p>
                                            <p className="mt-1 text-sm text-slate-200">{user.email}</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Status</p>
                                            <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${getStatusTone(user.active)}`}>
                                                {user.active ? "Ativo" : "Inativo"}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Papel</p>
                                            <p className="mt-1 text-sm text-slate-200">{user.role}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Criado em</p>
                                            <p className="mt-1 text-sm text-slate-200">{formatDate(user.createdAt)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Ultimo acesso</p>
                                            <p className="mt-1 text-sm text-slate-200">{user.lastAccessAt ? formatDate(user.lastAccessAt) : "-"}</p>
                                        </div>
                                    </div>

                                    {canManage ? (
                                        <div className="flex flex-col items-start gap-3">
                                            <form
                                                action={toggleRoute}
                                                method="post"
                                                onSubmit={(event) => {
                                                    if (!confirmMessage) return;
                                                    const confirmed = window.confirm(confirmMessage);
                                                    if (!confirmed) {
                                                        event.preventDefault();
                                                    }
                                                }}
                                            >
                                                <button
                                                    type="submit"
                                                    className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                                                        user.active
                                                            ? "border-rose-400/20 bg-rose-400/10 text-rose-100 hover:border-rose-400/30 hover:bg-rose-400/15"
                                                            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100 hover:border-emerald-400/30 hover:bg-emerald-400/15"
                                                    }`}
                                                >
                                                    {actionLabel}
                                                </button>
                                            </form>

                                            <div className="flex flex-wrap items-center gap-3">
                                                <button
                                                    type="button"
                                                    disabled={pendingResetUserId === user.id}
                                                    onClick={() => {
                                                        void handleResetAccess(user);
                                                    }}
                                                    className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-400/30 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {pendingResetUserId === user.id ? "Gerando..." : "Resetar acesso"}
                                                </button>
                                            </div>

                                            {resetFeedbackByUserId[user.id] ? (
                                                <p
                                                    className={`text-xs ${
                                                        resetFeedbackByUserId[user.id].tone === "success"
                                                            ? "text-emerald-200"
                                                            : "text-rose-200"
                                                    }`}
                                                >
                                                    {resetFeedbackByUserId[user.id].message}
                                                </p>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </section>
    );
}
