import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Building2, ChevronLeft, Layers3 } from "lucide-react";

import { getAuthContext } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import {
    getOrganizationDetails,
    getOrganizationLifecycleStatusClassName,
    getOrganizationLifecycleStatusLabel,
    getOrganizationSubscriptionStatusClassName,
    getOrganizationSubscriptionStatusLabel,
} from "@/lib/repositories/organizationRepository";

import { OrganizationStatusActions } from "./organization-status-actions";
import { OrganizationUsersPanel } from "./organization-users-panel";

export const runtime = "nodejs";

function formatDate(value: string): string {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatShortDate(value: string | null): string {
    if (!value) return "—";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default async function AgencyOrganizationDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ userAction?: string; userError?: string }>;
}) {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency" || !auth.organizationId) {
        redirect("/agency/login");
    }

    const { id } = await params;
    const resolvedSearchParams = await searchParams;
    const organization = await getOrganizationDetails(id);
    if (!organization) {
        notFound();
    }

    const canManageOrganizations = hasRole(auth.role ?? "viewer", "admin");
    const userNotice = (() => {
        switch (resolvedSearchParams.userAction) {
            case "created":
                return { tone: "success", message: "Usuario inicial criado com sucesso." };
            case "activated":
                return { tone: "success", message: "Usuario ativado com sucesso." };
            case "deactivated":
                return { tone: "success", message: "Usuario desativado com sucesso." };
            default:
                break;
        }

        switch (resolvedSearchParams.userError) {
            case "missing_fields":
                return { tone: "error", message: "Informe e-mail e senha para criar o usuario inicial." };
            case "not_found":
                return { tone: "error", message: "Organization ou usuario nao encontrado." };
            case "already_has_users":
                return { tone: "error", message: "Esta organization ja possui usuarios." };
            case "user_limit_reached":
                return { tone: "error", message: "Limite de usuarios da organization atingido." };
            case "email_conflict":
                return { tone: "error", message: "Este e-mail ja esta em uso por outro usuario." };
            default:
                return null;
        }
    })();

    return (
        <section className="space-y-6">
            <div className="rounded-[30px] border border-white/8 bg-[linear-gradient(135deg,rgba(34,211,238,0.10),rgba(10,22,36,0.95))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <Link href="/agency/organizations" className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white">
                                <ChevronLeft className="h-4 w-4" />
                                Organizations
                            </Link>
                            <span className="text-slate-500">·</span>
                            <span className="inline-flex items-center gap-1.5 text-cyan-100">
                                <Building2 className="h-4 w-4" />
                                {organization.name}
                            </span>
                        </div>
                        <div>
                            <h1 className="text-3xl font-semibold tracking-tight">{organization.name}</h1>
                            <p className="mt-2 text-sm text-slate-300">
                                {organization.slug} · {organization.industry} · plano {organization.plan}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getOrganizationLifecycleStatusClassName(organization.lifecycleStatus)}`}>
                            {getOrganizationLifecycleStatusLabel(organization.lifecycleStatus)}
                        </span>
                        <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getOrganizationSubscriptionStatusClassName(organization.normalizedSubscriptionStatus)}`}>
                            {getOrganizationSubscriptionStatusLabel(organization.normalizedSubscriptionStatus)}
                        </span>
                    </div>
                </div>

                {userNotice ? (
                    <div
                        className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                            userNotice.tone === "success"
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                : "border-rose-400/20 bg-rose-400/10 text-rose-100"
                        }`}
                        role="alert"
                    >
                        {userNotice.message}
                    </div>
                ) : null}

                <div className="mt-6">
                    <OrganizationStatusActions
                        organizationId={organization.id}
                        organizationName={organization.name}
                        lifecycleStatus={organization.lifecycleStatus}
                        canManage={canManageOrganizations}
                    />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: "Usuarios", value: String(organization.counts.users), detail: "Visibilidade basica dos usuarios vinculados" },
                    { label: "Workspaces", value: String(organization.counts.workspaces), detail: "Vinculos operacionais provisionados" },
                    { label: "Criada em", value: formatDate(organization.createdAt), detail: `Atualizada em ${formatDate(organization.updatedAt)}` },
                    { label: "Status", value: organization.subscriptionStatusLabel, detail: "Estado de operacao refletido no billing" },
                ].map((card) => (
                    <article key={card.label} className="rounded-[26px] border border-white/8 bg-[#0a1624] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{card.value}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{card.detail}</p>
                    </article>
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
                <section className="rounded-[30px] border border-white/8 bg-[#0a1624] p-6">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                            <Layers3 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Onboarding</p>
                            <h2 className="text-2xl font-semibold tracking-tight">Estado operacional do tenant</h2>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                        {[
                            ["Status", organization.onboarding.status ?? "not_started"],
                            ["Email conectado", formatShortDate(organization.onboarding.emailConnectedAt)],
                            ["Pipeline", formatShortDate(organization.onboarding.pipelineConfiguredAt)],
                            ["Primeiro contato", formatShortDate(organization.onboarding.firstContactAt)],
                            ["Primeiro deal", formatShortDate(organization.onboarding.firstDealAt)],
                            ["Concluido em", formatShortDate(organization.onboarding.completedAt)],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                                <p className="mt-2 text-sm font-medium text-white">{value}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <OrganizationUsersPanel
                    organizationId={organization.id}
                    organizationName={organization.name}
                    users={organization.users}
                    invites={organization.invites ?? []}
                    canManage={canManageOrganizations}
                />
            </div>

            <section className="rounded-[30px] border border-white/8 bg-[#0a1624] p-6">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-cyan-200">
                        <ArrowRight className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Workspaces</p>
                        <h2 className="text-2xl font-semibold tracking-tight">Vinculos operacionais</h2>
                        <p className="mt-1 text-xs text-slate-400">Exibindo ate 5 workspaces recentes.</p>
                    </div>
                </div>

                <div className="mt-6 space-y-3">
                    {organization.workspaces.slice(0, 5).length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400">
                            Nenhum workspace provisionado ainda.
                        </div>
                    ) : (
                        organization.workspaces.slice(0, 5).map((workspace) => (
                            <div key={workspace.id} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="font-medium text-white">{workspace.status}</p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Proposal {workspace.proposalId.slice(0, 8)} · Assessment {workspace.assessmentId.slice(0, 8)}
                                        </p>
                                    </div>
                                    <Link
                                        href={`/agency/commercial/workspaces/${workspace.id}`}
                                        className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400/30 hover:text-cyan-100"
                                    >
                                        Abrir workspace
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                    Criado em {formatDate(workspace.createdAt)} · {workspace.goLiveAt ? `Go-Live ${formatShortDate(workspace.goLiveAt)}` : "Go-Live pendente"}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </section>
    );
}
