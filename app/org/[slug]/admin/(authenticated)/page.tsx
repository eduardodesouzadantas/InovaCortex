import Link from "next/link";
import { redirect } from "next/navigation";

import { requireOrgContext } from "@/lib/auth/org-context";
import { can } from "@/lib/auth/rbac";
import { canAccessExecutiveSurface } from "@/lib/executive/access";
import { prisma } from "@/lib/prisma";
import { buildOperatorSurfaceOverview } from "@/lib/operator/surface-overview";

import { ClientKanbanBoard } from "../client-kanban";
import { OperatorDashboardView } from "./_components/operator-dashboard-view";

export const runtime = "nodejs";

export default async function OrgAdminPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    const ctx = await requireOrgContext(slug).catch(() => null);
    if (!ctx || !can(ctx.role, "viewDashboard")) {
        redirect(`/org/${slug}/admin/login`);
    }

    const [assessments, dashboard] = await Promise.all([
        prisma.assessment.findMany({
            where: { organizationId: ctx.orgId },
            orderBy: { createdAt: "desc" },
        }),
        buildOperatorSurfaceOverview(ctx.orgId, slug, ctx.orgSlug),
    ]);

    const canAccessExecutive = canAccessExecutiveSurface(ctx.role);

    return (
        <div className="space-y-8">
            <OperatorDashboardView
                data={dashboard}
                slug={slug}
                showExecutiveBridge={canAccessExecutive}
            />

            <section id="kanban" className="rounded-[30px] border border-white/8 bg-[#07101c] p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pipeline operacional</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Kanban de execucao</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                            Quando o operador sair da leitura de prioridade, o proximo passo esta aqui: mover cards e executar.
                        </p>
                    </div>
                    <Link
                        href={`/org/${slug}/admin/crm`}
                        className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-400/15"
                    >
                        Abrir CRM Workspace
                    </Link>
                    <Link
                        href={`/org/${slug}/avaliacao`}
                        className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15"
                    >
                        Nova avaliacao
                    </Link>
                </div>
                <ClientKanbanBoard initialLeads={assessments} />
            </section>
        </div>
    );
}
