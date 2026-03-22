import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, ChevronLeft, ExternalLink, Filter } from "lucide-react";

import { getAuthContext } from "@/lib/auth/session";
import { parsePagination } from "@/lib/http/pagination";
import {
    getOrganizationLifecycleStatusLabel,
    listOrganizations,
    normalizeOrganizationLifecycleFilter,
    ORGANIZATION_LIFECYCLE_STATUS_OPTIONS,
} from "@/lib/repositories/organizationRepository";

export const runtime = "nodejs";

function formatDate(value: string): string {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function buildLifecycleBadgeClassName(status: string): string {
    switch (status) {
        case "active":
            return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
        case "suspended":
            return "border-rose-400/20 bg-rose-400/10 text-rose-100";
        default:
            return "border-amber-400/20 bg-amber-400/10 text-amber-100";
    }
}

export default async function AgencyOrganizationsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; status?: string }>;
}) {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency" || !auth.organizationId) {
        redirect("/agency/login");
    }

    const sp = await searchParams;
    const query = new URLSearchParams();
    if (sp.page) query.set("page", sp.page);
    const pagination = parsePagination(query, { defaultLimit: 20, maxLimit: 50 });
    const status = normalizeOrganizationLifecycleFilter(sp.status);

    const result = await listOrganizations({
        page: pagination.page,
        limit: pagination.limit,
        status,
    });

    function buildUrl(extra: Record<string, string | undefined>): string {
        const nextParams = new URLSearchParams();
        if (status !== "all") {
            nextParams.set("status", status);
        }
        if (extra.status !== undefined) {
            if (extra.status) nextParams.set("status", extra.status);
            else nextParams.delete("status");
        }
        if (extra.page) {
            nextParams.set("page", extra.page);
        } else if (sp.page) {
            nextParams.set("page", sp.page);
        }
        return `?${nextParams.toString()}`;
    }

    return (
        <section className="space-y-6">
            <div className="rounded-[30px] border border-white/8 bg-[linear-gradient(135deg,rgba(34,211,238,0.10),rgba(10,22,36,0.95))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <Link href="/agency/dashboard" className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white">
                                <ChevronLeft className="h-4 w-4" />
                                Agency Home
                            </Link>
                            <span className="text-slate-500">·</span>
                            <span className="inline-flex items-center gap-1.5 text-cyan-100">
                                <Building2 className="h-4 w-4" />
                                Organizations
                            </span>
                        </div>
                        <div>
                            <h1 className="text-3xl font-semibold tracking-tight">Organizations</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                                Visibilidade centralizada das empresas do sistema, com status operacional e vínculo com workspace.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3 text-sm text-slate-300">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total</p>
                        <p className="mt-1 text-xl font-semibold text-white">{result.pagination.total}</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    <Filter className="h-3.5 w-3.5" />
                    Status
                </div>
                {ORGANIZATION_LIFECYCLE_STATUS_OPTIONS.map((option) => {
                    const active = option === status;
                    const label = option === "all" ? "Todas" : getOrganizationLifecycleStatusLabel(option);
                    const activeClass = option === "all"
                        ? "border-slate-500/20 bg-white/[0.03] text-slate-300"
                        : buildLifecycleBadgeClassName(option);

                    return (
                        <Link
                            key={option}
                            href={buildUrl({ page: "1", status: option === "all" ? "" : option })}
                            className={`rounded-full border px-3 py-1.5 text-xs transition ${active ? activeClass : "border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/16 hover:text-white"}`}
                        >
                            {label}
                        </Link>
                    );
                })}
            </div>

            <div className="overflow-hidden rounded-[30px] border border-white/8 bg-[#0a1624] shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/8">
                        <thead className="bg-black/20">
                            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                <th className="px-4 py-4 font-semibold">Empresa</th>
                                <th className="px-4 py-4 font-semibold">Status</th>
                                <th className="px-4 py-4 font-semibold">Workspace</th>
                                <th className="px-4 py-4 font-semibold">Criada em</th>
                                <th className="px-4 py-4 font-semibold">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/8">
                            {result.organizations.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                                        Nenhuma organization encontrada para o filtro atual.
                                    </td>
                                </tr>
                            ) : (
                                result.organizations.map((organization) => (
                                    <tr key={organization.id} className="align-top text-sm text-slate-200">
                                        <td className="px-4 py-4">
                                            <Link href={`/agency/organizations/${organization.id}`} className="font-semibold text-white hover:text-cyan-200">
                                                {organization.name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${buildLifecycleBadgeClassName(organization.lifecycleStatus)}`}>
                                                {getOrganizationLifecycleStatusLabel(organization.lifecycleStatus)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            {organization.latestWorkspace ? (
                                                <Link
                                                    href={`/agency/commercial/workspaces/${organization.latestWorkspace.id}`}
                                                    className="inline-flex items-center gap-1 text-cyan-200 hover:text-cyan-100"
                                                >
                                                    Workspace {organization.latestWorkspace.status}
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </Link>
                                            ) : (
                                                <span className="text-slate-500">Sem workspace</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-slate-300">{formatDate(organization.createdAt)}</td>
                                        <td className="px-4 py-4">
                                            <Link
                                                href={`/agency/organizations/${organization.id}`}
                                                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400/30 hover:text-cyan-100"
                                            >
                                                Abrir detalhe
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {result.pagination.pageCount >= 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-black/10 px-4 py-3 text-sm text-slate-300">
                    <span>
                        Página {result.pagination.page} de {result.pagination.pageCount}
                    </span>
                    <div className="flex items-center gap-2">
                        {result.pagination.hasPreviousPage ? (
                            <Link href={buildUrl({ page: String(result.pagination.page - 1) })} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:border-white/20 hover:text-white">
                                Anterior
                            </Link>
                        ) : null}
                        {result.pagination.hasNextPage ? (
                            <Link href={buildUrl({ page: String(result.pagination.page + 1) })} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:border-white/20 hover:text-white">
                                Próxima
                            </Link>
                        ) : null}
                    </div>
                </div>
            )}
        </section>
    );
}
