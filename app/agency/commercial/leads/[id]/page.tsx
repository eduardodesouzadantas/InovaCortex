/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
    ChevronLeft,
    FileText,
    Building2,
    User,
    Phone,
    Clock,
    Mail,
    AlertCircle,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/session";
import { InternalNotesEditor } from "@/app/admin/[id]/internal-notes";
import { PreSalesPanel } from "@/app/admin/[id]/presales-panel";
import { ROISimulator } from "@/app/admin/[id]/roi-simulator";
import { ProposalPanel } from "@/app/admin/[id]/proposal-panel";
import { BillingPanel } from "@/app/admin/[id]/billing-panel";
import { AssignmentPanel } from "@/app/admin/[id]/assignment-panel";
import { PdfDownloadButton } from "@/components/pdf-download-button";

export const runtime = "nodejs";

export default async function AgencyLeadCockpitPage({ params }: { params: Promise<{ id: string }> }) {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency") {
        redirect("/agency/login");
    }

    const { id } = await params;
    const lead = await (prisma as any).assessment.findUnique({
        where: { id },
        include: {
            artifactReport: true,
            messageLogs: { orderBy: { createdAt: "desc" as any } },
            auditEvents: { orderBy: { createdAt: "desc" as any } },
            assignments: {
                where: { status: "active" },
                include: { salesRep: true },
                take: 1,
            },
        },
    }) as any;

    const availableReps = await (prisma as any).salesRep.findMany({
        where: { active: true },
        select: { id: true, name: true, role: true },
    });

    const roiProjection = await (prisma as any).roiProjection.findUnique({
        where: { assessmentId: id },
    });

    const latestProposal = await (prisma as any).proposal.findFirst({
        where: { assessmentId: id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
    });

    const [billingRecord, contractRecord] = latestProposal
        ? await Promise.all([
            (prisma as any).billingRecord.findUnique({ where: { proposalId: latestProposal.id } }).catch(() => null),
            (prisma as any).contract.findUnique({ where: { proposalId: latestProposal.id } }).catch(() => null),
        ])
        : [null, null];

    if (!lead) {
        notFound();
    }

    const hoursSinceCreation = (new Date().getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60);
    const requiresFollowUp = lead.status === "Novo" && hoursSinceCreation > 24;
    const needsScheduling = lead.status === "Qualificado";

    return (
        <div className="min-h-screen bg-muted/10 p-8 pb-32 pt-24">
            <div className="mx-auto max-w-6xl space-y-6">
                <Link
                    href="/agency/commercial/leads"
                    className="mb-4 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className="h-4 w-4" /> Voltar ao pipeline comercial
                </Link>

                <div className="flex items-start justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-3">
                            <h1 className="text-3xl font-black text-foreground">{lead.name}</h1>
                            <span className="rounded-full border border-border/50 bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                                {lead.status}
                            </span>
                        </div>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="h-4 w-4" /> {lead.company} ({lead.segment})
                        </p>
                    </div>

                    <div className="text-right">
                        <div className="mb-1 text-4xl font-black text-primary">{lead.scoreTotal}</div>
                        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{lead.classification}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div className="glass-panel rounded-xl border border-border/50 p-4">
                                <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                    <User className="h-3 w-3" /> Cargo
                                </p>
                                <p className="font-semibold">{lead.role}</p>
                            </div>
                            <div className="glass-panel rounded-xl border border-border/50 p-4">
                                <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                    <User className="h-3 w-3" /> Equipe
                                </p>
                                <p className="font-semibold">
                                    {({
                                        "1_10": "1 a 10",
                                        "11_50": "11 a 50",
                                        "51_200": "51 a 200",
                                        "201_500": "201 a 500",
                                        "500_plus": "500+",
                                    } as Record<string, string>)[lead.teamSize as string] || lead.teamSize}
                                </p>
                            </div>
                            <AssignmentPanel
                                assessmentId={lead.id}
                                currentRep={lead.assignments?.[0]?.salesRep}
                                reps={availableReps}
                            />
                            <div className="glass-panel rounded-xl border border-border/50 p-4">
                                <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                    <Mail className="h-3 w-3" /> Canal
                                </p>
                                <p className="truncate text-sm font-semibold" title={JSON.parse(lead.channels || "[]").join(", ")}>
                                    {JSON.parse(lead.channels || "[]").length} canais
                                </p>
                            </div>
                            <div className="glass-panel rounded-xl border border-border/50 p-4">
                                <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" /> Lead Time
                                </p>
                                <p className="font-semibold">{Math.floor(hoursSinceCreation)}h</p>
                            </div>
                        </div>

                        <div className="glass-panel rounded-xl border border-primary/20 bg-primary/5 p-6">
                            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
                                <FileText className="h-5 w-5 text-primary" />
                                Dossie e artefatos
                            </h3>

                            {lead.artifactReport ? (
                                <div className="flex flex-wrap gap-4">
                                    <a
                                        href={`/diagnostico/${lead.artifactReport.publicSlug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-primary"
                                    >
                                        <FileText className="mr-2 h-4 w-4" />
                                        Visualizar dossie publico
                                    </a>
                                    <PdfDownloadButton
                                        slug={lead.artifactReport.publicSlug}
                                        className="btn-secondary disabled:opacity-60"
                                        label="Download PDF completo"
                                        title="Gerar e baixar PDF sem sair da pagina"
                                    />
                                </div>
                            ) : (
                                <p className="text-sm italic text-muted-foreground">Artefatos ainda nao gerados para esta avaliacao.</p>
                            )}
                        </div>

                        <div className="glass-panel rounded-xl border border-border/50 p-6">
                            <h3 className="mb-4 text-lg font-bold">Informacoes de contato</h3>
                            <div className="flex flex-col gap-3">
                                <p className="flex items-center gap-3">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <a href={`mailto:${lead.email}`} className="text-blue-400 hover:underline">
                                        {lead.email}
                                    </a>
                                </p>
                                <p className="flex items-center gap-3">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    {lead.phone ? (
                                        <span className="font-medium">{lead.phone}</span>
                                    ) : (
                                        <span className="italic text-muted-foreground">Nao informado</span>
                                    )}
                                    {lead.whatsappConsent && (
                                        <span className="ml-2 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-green-500">
                                            Opt-in
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {(requiresFollowUp || needsScheduling) && (
                            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5">
                                <h4 className="mb-2 flex items-center gap-2 font-bold text-yellow-500">
                                    <AlertCircle className="h-4 w-4" /> Sugestoes de acao
                                </h4>
                                {requiresFollowUp && (
                                    <p className="mb-3 text-sm text-yellow-500/90">
                                        Lead esta ha mais de 24h em status Novo. Sugere-se contato inicial imediato.
                                    </p>
                                )}
                                {needsScheduling && (
                                    <p className="mb-3 text-sm text-yellow-500/90">
                                        Lead esta qualificado. Proximo passo recomendado e agendamento de call.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="glass-panel flex h-[500px] flex-col rounded-xl border border-border/50 p-6">
                            <h3 className="mb-4 text-lg font-bold">Audit e timeline</h3>
                            <div className="relative flex-1 space-y-4 overflow-y-auto pr-2">
                                <div className="absolute bottom-0 left-3.5 top-2 z-0 w-0.5 bg-border/50" />

                                {lead.auditEvents.map((event: any) => (
                                    <div key={event.id} className="relative z-10 pl-10">
                                        <div className="absolute left-2 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary text-background shadow-sm" />

                                        <div className="mb-1 flex items-baseline justify-between">
                                            <span className="text-sm font-semibold capitalize">{event.action.replace("_", " ")}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {event.createdAt.toLocaleDateString("pt-BR", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border/30 bg-muted/30 p-2 text-xs text-muted-foreground">
                                            {event.details || "Acao de sistema"}
                                        </div>
                                    </div>
                                ))}

                                {lead.auditEvents.length === 0 && (
                                    <div className="py-8 text-center text-sm text-muted-foreground">Nenhum evento registrado.</div>
                                )}
                            </div>
                        </div>

                        <InternalNotesEditor leadId={lead.id} initialNotes={lead.internalNotes} apiBasePath="/api/agency/commercial/leads" />
                    </div>
                </div>

                <PreSalesPanel assessmentId={lead.id} apiBasePath="/api/agency/commercial/leads" />

                {roiProjection && (
                    <div className="glass-panel rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent p-6">
                        <ROISimulator
                            assessmentId={lead.id}
                            apiBasePath="/api/agency/commercial/leads"
                            initialROI={{
                                ...roiProjection,
                                savingsRange: "",
                                revenueRange: "",
                                hoursRange: "",
                            }}
                        />
                    </div>
                )}

                <ProposalPanel assessmentId={lead.id} apiBasePath="/api/agency/commercial/leads" />

                <BillingPanel
                    billing={billingRecord}
                    contract={contractRecord}
                    proposalId={latestProposal?.id ?? ""}
                    apiBasePath="/api/agency/commercial"
                />
            </div>
        </div>
    );
}
