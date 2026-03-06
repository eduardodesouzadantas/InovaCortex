import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronLeft, BrainCircuit, DollarSign, Zap, TrendingUp, BarChart2 } from "lucide-react";

export const runtime = "nodejs";

function formatUSD(n: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(n);
}
function formatBRL(n: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(n);
}
function fmt(n: number) {
    return new Intl.NumberFormat("pt-BR").format(Math.round(n));
}

export default async function CostDashboardPage({
    params
}: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    let ctx: Awaited<ReturnType<typeof requireOrgContext>>;
    try {
        ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "admin");
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const endOfLastMonth = new Date(startOfMonth.getTime() - 1);

    // Monthly aggregation
    const [thisMonth, lastMonth, topLeads, totalInvocations] = await Promise.all([
        (prisma as any).aIInvocation.aggregate({
            where: { organizationId: ctx!.orgId, createdAt: { gte: startOfMonth } },
            _sum: { promptTokens: true, completionTokens: true, estimatedCostUsd: true },
            _count: { _all: true },
        }),
        (prisma as any).aIInvocation.aggregate({
            where: { organizationId: ctx!.orgId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
            _sum: { promptTokens: true, completionTokens: true, estimatedCostUsd: true },
            _count: { _all: true },
        }),
        // Top leads by AI cost
        (prisma as any).aIInvocation.groupBy({
            by: ["assessmentId"],
            where: { organizationId: ctx!.orgId, createdAt: { gte: startOfMonth } },
            _sum: { estimatedCostUsd: true, promptTokens: true, completionTokens: true },
            _count: { _all: true },
            orderBy: { _sum: { estimatedCostUsd: "desc" } },
            take: 10,
        }),
        (prisma as any).aIInvocation.count({ where: { organizationId: ctx!.orgId } }),
    ]);

    // Enrich top leads with company name
    const assessmentIds = topLeads.map((r: any) => r.assessmentId);
    const assessments: any[] = assessmentIds.length > 0
        ? await (prisma as any).assessment.findMany({
            where: { id: { in: assessmentIds } },
            select: { id: true, company: true, scoreTotal: true },
        })
        : [];
    const assessmentMap: Record<string, any> = {};
    for (const a of assessments) assessmentMap[a.id] = a;

    const costThisMonth = thisMonth._sum.estimatedCostUsd ?? 0;
    const costLastMonth = lastMonth._sum.estimatedCostUsd ?? 0;
    const tokensThisMonth = (thisMonth._sum.promptTokens ?? 0) + (thisMonth._sum.completionTokens ?? 0);
    const callsThisMonth = thisMonth._count._all ?? 0;
    const avgCostPerCall = callsThisMonth > 0 ? costThisMonth / callsThisMonth : 0;

    // Success rate
    const failedThisMonth = await (prisma as any).aIInvocation.count({
        where: { organizationId: ctx!.orgId, createdAt: { gte: startOfMonth }, status: { not: "success" } }
    });
    const successRate = callsThisMonth > 0 ? Math.round(((callsThisMonth - failedThisMonth) / callsThisMonth) * 100) : 100;

    const costTrend = costLastMonth > 0
        ? Math.round(((costThisMonth - costLastMonth) / costLastMonth) * 100)
        : null;

    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    return (
        <div className="min-h-screen bg-background">
            <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3">
                <div className="max-w-5xl mx-auto flex items-center gap-4">
                    <Link href={`/org/${slug}/admin`}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm">
                        <ChevronLeft className="w-4 h-4" /> Mission Control
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-semibold text-sm flex items-center gap-1.5">
                        <BrainCircuit className="w-4 h-4 text-primary" /> Custos de IA
                    </span>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
                <div>
                    <h1 className="text-3xl font-black mb-1">Dashboard de Custos</h1>
                    <p className="text-muted-foreground text-sm">Período: <strong>{month}</strong> · {totalInvocations} chamadas no total</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        {
                            label: "Custo (mês)",
                            value: formatUSD(costThisMonth),
                            sub: costTrend !== null
                                ? `${costTrend >= 0 ? "+" : ""}${costTrend}% vs mês anterior`
                                : "Primeiro mês",
                            icon: DollarSign,
                            color: "text-green-500",
                        },
                        {
                            label: "Tokens (mês)",
                            value: fmt(tokensThisMonth),
                            sub: `${callsThisMonth} chamadas`,
                            icon: Zap,
                            color: "text-blue-400",
                        },
                        {
                            label: "Custo médio/call",
                            value: formatUSD(avgCostPerCall),
                            sub: `Todos os modelos`,
                            icon: BarChart2,
                            color: "text-purple-400",
                        },
                        {
                            label: "Taxa de sucesso",
                            value: `${successRate}%`,
                            sub: `${failedThisMonth} falhas`,
                            icon: TrendingUp,
                            color: successRate >= 95 ? "text-green-500" : successRate >= 80 ? "text-yellow-500" : "text-red-500",
                        },
                    ].map(card => {
                        const Icon = card.icon;
                        return (
                            <div key={card.label} className="glass-panel rounded-xl border border-border/50 p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon className={`w-5 h-5 ${card.color}`} />
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{card.label}</p>
                                </div>
                                <p className="text-2xl font-black">{card.value}</p>
                                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Top Leads */}
                {topLeads.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold mb-4">Top Leads por Custo de IA</h2>
                        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/30 bg-muted/10">
                                        <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Empresa</th>
                                        <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold">Score</th>
                                        <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold">Tokens</th>
                                        <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold">Chamadas</th>
                                        <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold">Custo (USD)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topLeads.map((row: any, i: number) => {
                                        const a = assessmentMap[row.assessmentId];
                                        return (
                                            <tr key={row.assessmentId} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                                                <td className="px-4 py-3">
                                                    <Link href={`/org/${slug}/admin/${row.assessmentId}`}
                                                        className="text-primary hover:underline font-medium">
                                                        {a?.company ?? row.assessmentId.slice(0, 8)}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3 text-right text-muted-foreground">{a?.scoreTotal ?? "—"}</td>
                                                <td className="px-4 py-3 text-right">{fmt((row._sum.promptTokens ?? 0) + (row._sum.completionTokens ?? 0))}</td>
                                                <td className="px-4 py-3 text-right text-muted-foreground">{row._count._all}</td>
                                                <td className="px-4 py-3 text-right font-bold text-green-500">{formatUSD(row._sum.estimatedCostUsd ?? 0)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {callsThisMonth === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                        <BrainCircuit className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Nenhuma chamada de IA registrada neste mês.</p>
                        <p className="text-xs mt-1">Gere um artefato de Pré-Vendas para ver os dados de custo.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
