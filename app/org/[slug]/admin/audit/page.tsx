import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AuditExportButton } from "./export-button";
import {
    ChevronLeft, Activity, Shield, Zap, AlertTriangle,
    CheckCircle2, CreditCard, RefreshCw, FileText, BarChart2
} from "lucide-react";

export const runtime = "nodejs";

const CRITICAL_TYPES = new Set([
    "limitExceeded", "proposalStatusChanged",
    "stripe:subscription.deleted", "tokenChanged",
    "webhookFailure", "aiFailureRate",
]);

const EVENT_ICONS: Record<string, any> = {
    created: FileText,
    proposalGenerated: FileText,
    proposalStatusChanged: CheckCircle2,
    roiGenerated: BarChart2,
    roiAdjusted: BarChart2,
    limitExceeded: AlertTriangle,
    whatsappSent: Zap,
    statusChanged: RefreshCw,
    pdfGenerated: FileText,
    presalesGenerated: Zap,
    webhookFailure: AlertTriangle,
    aiFailureRate: AlertTriangle,
};

const SEVERITY_STYLE: Record<string, string> = {
    critical: "border-red-500/40    bg-red-500/5    text-red-400",
    warning: "border-yellow-500/40 bg-yellow-500/5 text-yellow-400",
    info: "border-border/50     bg-muted/5      text-muted-foreground",
};

function formatDate(d: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
    }).format(new Date(d));
}

export default async function AuditViewerPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ type?: string; from?: string; to?: string; entity?: string; page?: string }>;
}) {
    const { slug } = await params;
    const sp = await searchParams;

    let ctx: Awaited<ReturnType<typeof requireOrgContext>>;
    try {
        ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "admin");
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    const page = Math.max(1, Number(sp.page ?? 1));
    const perPage = 30;

    const where: any = { organizationId: ctx!.orgId };
    if (sp.type) where.action = sp.type;
    if (sp.entity) where.assessmentId = { contains: sp.entity };
    if (sp.from || sp.to) {
        where.createdAt = {};
        if (sp.from) where.createdAt.gte = new Date(sp.from);
        if (sp.to) where.createdAt.lte = new Date(sp.to + "T23:59:59Z");
    }

    const [events, total, distinctTypes] = await Promise.all([
        (prisma as any).auditEvent.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * perPage,
            take: perPage,
            include: { assessment: { select: { company: true, scoreTotal: true } } },
        }),
        (prisma as any).auditEvent.count({ where }),
        (prisma as any).auditEvent.findMany({
            where: { organizationId: ctx!.orgId },
            distinct: ["action"],
            select: { action: true },
        }),
    ]);

    const totalPages = Math.ceil(total / perPage);
    const types = distinctTypes.map((e: any) => e.action).sort();

    function buildUrl(extra: Record<string, string | undefined>) {
        const params = new URLSearchParams({
            ...(sp.type ? { type: sp.type } : {}),
            ...(sp.from ? { from: sp.from } : {}),
            ...(sp.to ? { to: sp.to } : {}),
            ...(sp.entity ? { entity: sp.entity } : {}),
            ...extra,
        });
        return `?${params.toString()}`;
    }

    return (
        <div className="min-h-screen bg-background">
            <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3">
                <div className="max-w-6xl mx-auto flex items-center gap-4">
                    <Link href={`/org/${slug}/admin`}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm">
                        <ChevronLeft className="w-4 h-4" /> Mission Control
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-semibold text-sm flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-primary" /> Audit Log
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{total} eventos</span>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                {/* Filters */}
                <form method="GET" className="glass-panel rounded-xl border border-border/50 p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
                            <select name="type" defaultValue={sp.type ?? ""}
                                className="w-full h-9 px-3 rounded-lg border border-border bg-muted/20 text-sm">
                                <option value="">Todos</option>
                                {types.map((t: string) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">De</label>
                            <input type="date" name="from" defaultValue={sp.from ?? ""}
                                className="w-full h-9 px-3 rounded-lg border border-border bg-muted/20 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Até</label>
                            <input type="date" name="to" defaultValue={sp.to ?? ""}
                                className="w-full h-9 px-3 rounded-lg border border-border bg-muted/20 text-sm" />
                        </div>
                        <div className="flex items-end gap-2">
                            <button type="submit" className="flex-1 btn-primary h-9 text-sm">Filtrar</button>
                            <AuditExportButton orgSlug={slug} filters={{ type: sp.type, from: sp.from, to: sp.to }} />
                        </div>
                    </div>
                </form>

                {/* Event Timeline */}
                <div className="space-y-2">
                    {events.length === 0 && (
                        <div className="text-center text-muted-foreground py-16">
                            <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            Nenhum evento encontrado
                        </div>
                    )}
                    {events.map((ev: any) => {
                        const isCritical = CRITICAL_TYPES.has(ev.action);
                        const Icon = EVENT_ICONS[ev.action] ?? Activity;
                        const style = isCritical
                            ? SEVERITY_STYLE.critical
                            : SEVERITY_STYLE.info;

                        return (
                            <div key={ev.id}
                                className={`rounded-xl border p-4 flex items-start gap-4 ${style}`}
                            >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isCritical ? "bg-red-500/15" : "bg-primary/10"}`}>
                                    <Icon className={`w-4 h-4 ${isCritical ? "text-red-400" : "text-primary"}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-sm">{ev.action}</span>
                                        {isCritical && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-400/20">
                                                crítico
                                            </span>
                                        )}
                                        {ev.assessment?.company && (
                                            <Link href={`/org/${slug}/admin/${ev.assessmentId}`}
                                                className="text-xs text-primary hover:underline">
                                                {ev.assessment.company} ({ev.assessment.scoreTotal}pts)
                                            </Link>
                                        )}
                                    </div>
                                    {ev.details && (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                            {ev.details?.length > 200 ? ev.details.slice(0, 200) + "…" : ev.details}
                                        </p>
                                    )}
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">
                                    {formatDate(ev.createdAt)}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                        {page > 1 && (
                            <Link href={buildUrl({ page: String(page - 1) })}
                                className="btn-secondary text-sm px-4 py-2">← Anterior</Link>
                        )}
                        <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                        {page < totalPages && (
                            <Link href={buildUrl({ page: String(page + 1) })}
                                className="btn-secondary text-sm px-4 py-2">Próxima →</Link>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
