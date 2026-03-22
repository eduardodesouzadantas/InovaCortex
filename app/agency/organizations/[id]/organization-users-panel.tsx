"use client";

import type { OrganizationUserRecord } from "@/lib/repositories/organizationUserRepository";

function formatDate(value: string): string {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function getStatusTone(active: boolean): string {
    return active
        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
        : "border-rose-400/20 bg-rose-400/10 text-rose-100";
}

export function OrganizationUsersPanel({
    organizationId,
    organizationName,
    users,
    canManage,
}: {
    organizationId: string;
    organizationName: string;
    users: OrganizationUserRecord[];
    canManage: boolean;
}) {
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

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                            Sem convite ficticio ou fluxo de reset.
                        </p>
                    </div>
                </form>
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
                                            <p className="mt-1 font-medium text-white">{user.name ?? "—"}</p>
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
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Último acesso</p>
                                            <p className="mt-1 text-sm text-slate-200">{user.lastAccessAt ? formatDate(user.lastAccessAt) : "—"}</p>
                                        </div>
                                    </div>

                                    {canManage ? (
                                        <form
                                            action={toggleRoute}
                                            method="post"
                                            className="flex flex-wrap items-center gap-3"
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
