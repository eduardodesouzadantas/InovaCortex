import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/rbac";
import Link from "next/link";
import { BrainCircuit, Settings, LogOut, Users, TrendingUp, FileText, Zap, Shield } from "lucide-react";
import { ClientKanbanBoard } from "../client-kanban";

export const runtime = "nodejs";

export default async function OrgAdminPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    // Auth + isolation check
    let ctx: Awaited<ReturnType<typeof requireOrgContext>>;
    try {
        ctx = await requireOrgContext(slug);
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    if (!can(ctx.role, "viewDashboard")) {
        redirect(`/org/${slug}/admin/login`);
    }

    // Load org assessments
    const assessments = await (prisma as any).assessment.findMany({
        where: { organizationId: ctx.orgId },
        orderBy: { createdAt: "desc" },
    });

    const activeCount = assessments.length;
    const hotLeads = assessments.filter((a: any) => a.scoreTotal >= 70).length;
    const closedCount = assessments.filter((a: any) => a.status === "fechado").length;

    const stats = [
        { label: "Pipeline (30d)", value: activeCount, icon: <TrendingUp className="w-4 h-4 text-blue-400" /> },
        { label: "Hot Leads", value: hotLeads, icon: <Zap className="w-4 h-4 text-yellow-400" /> },
        { label: "Close Rate", value: activeCount ? Math.round((closedCount / activeCount) * 100) + "%" : "0%", icon: <Users className="w-4 h-4 text-green-400" /> },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border/40 bg-card p-6 flex flex-col justify-between">
                <div className="space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
                            <BrainCircuit className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-bold tracking-tight">{slug}</span>
                    </div>

                    <nav className="space-y-2">
                        <Link href={`/org/${slug}/admin`} className="flex flex-col p-3 rounded-lg bg-primary/10 text-primary border border-primary/20">
                            <span className="font-semibold text-sm">Mission Control</span>
                            <span className="text-xs opacity-80">Kanban & Leads</span>
                        </Link>
                        <Link href={`/org/${slug}/admin/cockpit`} className="flex flex-col p-3 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors">
                            <span className="font-semibold text-sm text-foreground">Cockpit (War Room)</span>
                            <span className="text-xs opacity-80">Ações prioritárias</span>
                        </Link>
                        <Link href={`/org/${slug}/admin/configuracoes`} className="flex flex-col p-3 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors">
                            <span className="font-semibold text-sm text-foreground">Configurações</span>
                            <span className="text-xs opacity-80">Tokens & Webhooks</span>
                        </Link>
                    </nav>
                </div>
                <div className="pt-6 border-t border-border/40 space-y-4">
                    <div className="flex items-center gap-2 px-3">
                        <Shield className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-muted-foreground capitalize">Role: {ctx.role}</span>
                    </div>
                    <Link href={`/org/${slug}/admin/login`} className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-white transition-colors">
                        <LogOut className="w-4 h-4" /> Sair
                    </Link>
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 p-8 space-y-8 overflow-auto relative">
                <div className="absolute top-0 left-0 w-full h-96 bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
                        <p className="text-muted-foreground">Visão geral do pipeline de assessments.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href={`/org/${slug}/admin/cockpit`}
                            className="bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2">
                            <Zap className="w-4 h-4" /> Go to Cockpit
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {stats.map(s => (
                        <div key={s.label} className="glass-panel rounded-xl border border-border/50 p-4 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center">{s.icon}</div>
                            <div>
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                                <p className="font-bold">{s.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Kanban Board */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">Pipeline de Leads</h2>
                        <Link href={`/org/${slug}/avaliacao`}
                            className="btn-primary text-sm flex items-center gap-2">
                            + Nova Avaliação
                        </Link>
                    </div>
                    <ClientKanbanBoard initialLeads={assessments as any} />
                </div>
            </main>
        </div>
    );
}
