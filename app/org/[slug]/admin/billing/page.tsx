import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { currentMonth, PLAN_LIMITS, getMonthlyCount } from "@/lib/usage";
import { isStripeEnabled } from "@/lib/stripe";
import { assertRole } from "@/lib/auth/rbac";
import Link from "next/link";
import { normalizeOrganizationAccountStatus, organizationAccountStatusLabel } from "@/lib/billing/account-status";
import { BillingUpgradeButton } from "./upgrade-button";
import {
    BrainCircuit, CreditCard, Zap, TrendingUp,
    FileText, MessageSquare, BarChart2, ChevronLeft,
    CheckCircle2, AlertTriangle, Clock
} from "lucide-react";

export const runtime = "nodejs";

const PLAN_LABELS: Record<string, { label: string; color: string; badge: string }> = {
    free: { label: "Free", color: "text-gray-400", badge: "bg-gray-400/10  border-gray-400/20" },
    growth: { label: "Growth", color: "text-blue-400", badge: "bg-blue-400/10  border-blue-400/20" },
    enterprise: { label: "Enterprise", color: "text-yellow-400", badge: "bg-yellow-400/10 border-yellow-400/20" },
};

const STATUS_CONFIG: Record<"active" | "trial" | "suspended", { icon: any; label: string; color: string }> = {
    active: { icon: CheckCircle2, label: "Ativa", color: "text-green-500" },
    trial: { icon: Clock, label: "Trial", color: "text-blue-400" },
    suspended: { icon: AlertTriangle, label: "Suspensa", color: "text-red-400" },
};

function fmt(n: number) {
    return new Intl.NumberFormat("pt-BR").format(n);
}

function usageBar(current: number, max: number) {
    const pct = Math.min(100, Math.round((current / Math.max(max, 1)) * 100));
    const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-primary";
    return { pct, color };
}

export default async function BillingPage({
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

    const org = await (prisma as any).organization.findUnique({
        where: { id: ctx!.orgId }
    });

    const month = currentMonth();
    const planLimits = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS.free;
    const planInfo = PLAN_LABELS[org.plan] ?? PLAN_LABELS.free;
    const normalizedStatus = normalizeOrganizationAccountStatus(org.subscriptionStatus);
    const statusConfig = STATUS_CONFIG[normalizedStatus];

    // Fetch live usage counts
    const [assessments, aiGenerations, proposals, pdfs, dossiers] = await Promise.all([
        getMonthlyCount(ctx!.orgId, "assessmentCreated"),
        getMonthlyCount(ctx!.orgId, "presalesGenerated"),
        getMonthlyCount(ctx!.orgId, "proposalGenerated"),
        getMonthlyCount(ctx!.orgId, "pdfGenerated"),
        getMonthlyCount(ctx!.orgId, "dossierGenerated"),
    ]);

    const usageMetrics = [
        { label: "Avaliações", icon: FileText, current: assessments, max: planLimits.assessmentCreated ?? 50, type: "assessmentCreated" },
        { label: "IA (Pré-Vend)", icon: BrainCircuit, current: aiGenerations, max: planLimits.presalesGenerated ?? 5, type: "presalesGenerated" },
        { label: "Propostas", icon: MessageSquare, current: proposals, max: planLimits.proposalGenerated ?? 5, type: "proposalGenerated" },
        { label: "PDFs", icon: TrendingUp, current: pdfs, max: planLimits.pdfGenerated ?? 20, type: "pdfGenerated" },
        { label: "Dossiês", icon: BarChart2, current: dossiers, max: planLimits.dossierGenerated ?? 20, type: "dossierGenerated" },
    ];

    const stripeEnabled = isStripeEnabled();
    const StatusIcon = statusConfig.icon;

    return (
        <div className="min-h-screen bg-background">
            {/* Topbar */}
            <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3">
                <div className="max-w-5xl mx-auto flex items-center gap-4">
                    <Link href={`/org/${slug}/admin`}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm">
                        <ChevronLeft className="w-4 h-4" /> Mission Control
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-semibold text-sm">Billing & Uso</span>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-black mb-1">Billing & Uso</h1>
                        <p className="text-muted-foreground text-sm">
                            Período: <strong>{month}</strong> · Organização: <strong>{org.name}</strong>
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold px-4 py-1.5 rounded-full border ${planInfo.badge} ${planInfo.color}`}>
                            {planInfo.label}
                        </span>
                        <span className={`flex items-center gap-1.5 text-sm ${statusConfig.color}`}>
                            <StatusIcon className="w-4 h-4" />
                            {organizationAccountStatusLabel(normalizedStatus)}
                        </span>
                    </div>
                </div>

                {normalizedStatus === "suspended" && (
                    <div className="glass-panel rounded-xl border border-rose-400/20 bg-rose-400/10 p-5">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-200" />
                            <div className="space-y-1">
                                <p className="font-semibold text-rose-50">Conta suspensa</p>
                                <p className="text-sm text-rose-50/80">
                                    O uso operacional fica bloqueado até a regularização do billing. Você ainda pode revisar esta tela e abrir o fluxo de upgrade.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Subscription period */}
                {org.currentPeriodEnd && (
                    <div className="glass-panel rounded-xl border border-border/50 p-5 flex items-center gap-4">
                        <CreditCard className="w-6 h-6 text-primary shrink-0" />
                        <div>
                            <p className="font-semibold text-sm">Assinatura ativa</p>
                            <p className="text-xs text-muted-foreground">
                                Período: {new Date(org.currentPeriodStart).toLocaleDateString("pt-BR")} →{" "}
                                {new Date(org.currentPeriodEnd).toLocaleDateString("pt-BR")}
                            </p>
                        </div>
                        <p className="ml-auto text-xs text-muted-foreground monospace">ID: {org.stripeSubscriptionId}</p>
                    </div>
                )}

                {/* Usage Cards */}
                <div>
                    <h2 className="text-lg font-bold mb-4">Uso em {month}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {usageMetrics.map(m => {
                            const { pct, color } = usageBar(m.current, m.max);
                            const Icon = m.icon;
                            return (
                                <div key={m.type} className="glass-panel rounded-xl border border-border/50 p-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Icon className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">{m.label}</p>
                                            <p className="text-xs text-muted-foreground">
                                                <span className="font-bold text-foreground">{fmt(m.current)}</span> / {m.max === 9999 ? "∞" : fmt(m.max)}
                                            </p>
                                        </div>
                                        <span className={`text-xs font-bold ${pct >= 90 ? "text-red-500" : pct >= 70 ? "text-yellow-500" : "text-muted-foreground"}`}>
                                            {pct}%
                                        </span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${color}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Upgrade CTA */}
                {org.plan !== "enterprise" && (
                    <div className="glass-panel rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-purple-500/5 p-8">
                        <div className="flex items-start justify-between gap-6 flex-wrap">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap className="w-5 h-5 text-yellow-500" />
                                    <h3 className="font-bold text-lg">Faça upgrade do seu plano</h3>
                                </div>
                                <p className="text-muted-foreground text-sm max-w-md">
                                    {org.plan === "free"
                                        ? "O plano Free tem limites reduzidos. Migre para Growth e escale suas operações com até 100 avaliações/mês e 50 gerações de IA."
                                        : "Migre para Enterprise para uso ilimitado, suporte dedicado, e configurações white-label."}
                                </p>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    {org.plan === "free" && (
                                        <BillingUpgradeButton plan="growth" label="Upgrade para Growth" stripeEnabled={stripeEnabled} orgSlug={slug} />
                                    )}
                                    <BillingUpgradeButton plan="enterprise" label="Falar com Vendas (Enterprise)" stripeEnabled={stripeEnabled} orgSlug={slug} isEnterprise />
                                </div>
                            </div>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                {[
                                    "100 avaliações/mês (Growth)",
                                    "50 gerações de IA/mês",
                                    "Usuários ilimitados",
                                    "White-label (Enterprise)",
                                    "Suporte prioritário",
                                ].map(f => (
                                    <div key={f} className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                                        {f}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Enterprise contact */}
                {org.plan === "enterprise" && (
                    <div className="glass-panel rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6 text-center">
                        <p className="font-bold text-lg">Plano Enterprise Ativo</p>
                        <p className="text-sm text-muted-foreground mt-1">Uso ilimitado · Precisa de algo? Entre em contato via email.</p>
                    </div>
                )}

                {!stripeEnabled && (
                    <p className="text-xs text-muted-foreground/50 text-center">
                        💡 Configure <code>STRIPE_SECRET_KEY</code> nas variáveis de ambiente para ativar pagamentos automáticos.
                    </p>
                )}
            </main>
        </div>
    );
}
