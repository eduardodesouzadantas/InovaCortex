import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { ChevronLeft, FileText, Download, Building2, User, Phone, CheckCircle2, Clock, Mail, AlertCircle } from "lucide-react";
import { InternalNotesEditor } from "./internal-notes";
import { PreSalesPanel } from "./presales-panel";
import { ROISimulator } from "./roi-simulator";
import { ProposalPanel } from "./proposal-panel";
import { BillingPanel } from "./billing-panel";
import { AssignmentPanel } from "./assignment-panel";


export const runtime = "nodejs";

export default async function LeadCockpitPage({ params }: { params: Promise<{ id: string }> }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token");

    if (!token || token.value !== "authenticated_true") {
        redirect("/admin/login");
    }

    const resolvedParams = await params;
    const lead = await (prisma as any).assessment.findUnique({
        where: { id: resolvedParams.id },
        include: {
            artifactReport: true,
            messageLogs: { orderBy: { createdAt: 'desc' as any } },
            auditEvents: { orderBy: { createdAt: 'desc' as any } },
            assignments: {
                where: { status: "active" },
                include: { salesRep: true },
                take: 1
            }
        }
    }) as any;

    const availableReps = await (prisma as any).salesRep.findMany({
        where: { active: true },
        select: { id: true, name: true, role: true }
    });

    // Load ROI separately to avoid TS issues
    const roiProjection = await (prisma as any).roiProjection.findUnique({
        where: { assessmentId: resolvedParams.id }
    });

    // V18: Load billing + contract for the lead's latest proposal
    const latestProposal = await (prisma as any).proposal.findFirst({
        where: { assessmentId: resolvedParams.id },
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

    // Calculando follow up widget flags
    const hoursSinceCreation = (new Date().getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60);
    const requiresFollowUp = lead.status === "Novo" && hoursSinceCreation > 24;
    const needsScheduling = lead.status === "Qualificado";

    return (
        <div className="min-h-screen bg-muted/10 p-8 pt-24 pb-32">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header Back Link */}
                <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 w-fit mb-4">
                    <ChevronLeft className="w-4 h-4" /> Voltar ao Mission Control
                </Link>

                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-black text-foreground">{lead.name}</h1>
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-muted text-foreground border border-border/50">
                                {lead.status}
                            </span>
                        </div>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <Building2 className="w-4 h-4" /> {lead.company} ({lead.segment})
                        </p>
                    </div>

                    <div className="text-right">
                        <div className="text-4xl font-black text-primary mb-1">{lead.scoreTotal}</div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{lead.classification}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Painel Esquerdo: Info da Lead */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Highlights Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="glass-panel p-4 rounded-xl border border-border/50">
                                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Cargo</p>
                                <p className="font-semibold">{lead.role}</p>
                            </div>
                            <div className="glass-panel p-4 rounded-xl border border-border/50">
                                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Equipe</p>
                                <p className="font-semibold">{{
                                    "1_10": "1 a 10",
                                    "11_50": "11 a 50",
                                    "51_200": "51 a 200",
                                    "201_500": "201 a 500",
                                    "500_plus": "500+",
                                }[lead.teamSize] || lead.teamSize}</p>
                            </div>
                            {/* Mission V35: Assignment Panel */}
                            <AssignmentPanel
                                assessmentId={lead.id}
                                currentRep={lead.assignments?.[0]?.salesRep}
                                reps={availableReps}
                            />
                            <div className="glass-panel p-4 rounded-xl border border-border/50">
                                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Canal</p>
                                <p className="text-sm font-semibold truncate" title={JSON.parse(lead.channels || '[]').join(', ')}>
                                    {JSON.parse(lead.channels || '[]').length} canais
                                </p>
                            </div>
                            <div className="glass-panel p-4 rounded-xl border border-border/50">
                                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Lead Time</p>
                                <p className="font-semibold">{Math.floor(hoursSinceCreation)}h</p>
                            </div>
                        </div>

                        {/* Artifacts Module */}
                        <div className="glass-panel p-6 rounded-xl border border-primary/20 bg-primary/5">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                Dossiê & Artefatos
                            </h3>

                            {lead.artifactReport ? (
                                <div className="flex flex-wrap gap-4">
                                    <a
                                        href={`/diagnostico/${lead.artifactReport.publicSlug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-primary"
                                    >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Visualizar Dossiê Público
                                    </a>
                                    <a
                                        href={`/api/pdf/${lead.artifactReport.publicSlug}`}
                                        download
                                        className="btn-secondary"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download PDF Completo
                                    </a>
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-sm italic">Artefatos ainda não gerados para esta Avaliação (Versão V1).</p>
                            )}
                        </div>

                        {/* Contatos */}
                        <div className="glass-panel p-6 rounded-xl border border-border/50">
                            <h3 className="font-bold text-lg mb-4">Informações de Contato</h3>
                            <div className="flex flex-col gap-3">
                                <p className="flex items-center gap-3">
                                    <Mail className="w-4 h-4 text-muted-foreground" />
                                    <a href={`mailto:${lead.email}`} className="text-blue-400 hover:underline">{lead.email}</a>
                                </p>
                                <p className="flex items-center gap-3">
                                    <Phone className="w-4 h-4 text-muted-foreground" />
                                    {lead.phone ? (
                                        <span className="font-medium">{lead.phone}</span>
                                    ) : (
                                        <span className="text-muted-foreground italic">Não informado</span>
                                    )}
                                    {lead.whatsappConsent && (
                                        <span className="bg-green-500/10 text-green-500 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ml-2">Opt-in</span>
                                    )}
                                </p>
                            </div>
                        </div>

                    </div>

                    {/* Painel Direito: CRM Timeline & Actions */}
                    <div className="space-y-6">

                        {/* Auto-Suggestions */}
                        {(requiresFollowUp || needsScheduling) && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 p-5 rounded-xl">
                                <h4 className="font-bold text-yellow-500 mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Sugestões de Ação
                                </h4>
                                {requiresFollowUp && (
                                    <p className="text-sm text-yellow-500/90 mb-3">Lead está a mais de 24h em Status "Novo". Sugere-se uma tentativa de contato inicial ou envio de dossier via WhatsApp.</p>
                                )}
                                {needsScheduling && (
                                    <p className="text-sm text-yellow-500/90 mb-3">Lead está Qualificado. Próximo passo ideal é encaminhar o link do Calendly para agendamento.</p>
                                )}
                            </div>
                        )}

                        {/* Audit Timeline */}
                        <div className="glass-panel p-6 rounded-xl border border-border/50 h-[500px] flex flex-col">
                            <h3 className="font-bold text-lg mb-4">Audit & Timeline</h3>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-4 relative">
                                {/* Linha vertical da timeline */}
                                <div className="absolute left-3.5 top-2 bottom-0 w-0.5 bg-border/50 z-0"></div>

                                {lead.auditEvents.map((event: any) => (
                                    <div key={event.id} className="relative z-10 pl-10">
                                        {/* Bolinha da timeline */}
                                        <div className="absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-background 
                                            bg-primary text-background shadow-sm"></div>

                                        <div className="mb-1 flex justify-between items-baseline">
                                            <span className="font-semibold text-sm capitalize">{event.action.replace('_', ' ')}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {event.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md border border-border/30 overflow-x-auto whitespace-pre-wrap">
                                            {event.details || "Ação de sistema"}
                                        </div>
                                    </div>
                                ))}

                                {lead.auditEvents.length === 0 && (
                                    <div className="text-center text-sm text-muted-foreground py-8">
                                        Nenhum evento registrado.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Internal Notes Editor */}
                        <InternalNotesEditor leadId={lead.id} initialNotes={lead.internalNotes} />

                    </div>
                </div>

                {/* Pre-Sales AI Agent Panel — Full Width */}
                <PreSalesPanel assessmentId={lead.id} />

                {/* ROI Simulator — Full Width */}
                {roiProjection && (
                    <div className="glass-panel rounded-xl border border-purple-500/20 p-6 bg-gradient-to-br from-purple-500/5 to-transparent">
                        <ROISimulator
                            assessmentId={lead.id}
                            initialROI={{
                                ...roiProjection,
                                savingsRange: '',
                                revenueRange: '',
                                hoursRange: '',
                            }}
                        />
                    </div>
                )}

                {/* Proposal Engine — Full Width */}
                <ProposalPanel assessmentId={lead.id} />

                {/* V18: Billing & Contract Panel */}
                <BillingPanel
                    billing={billingRecord}
                    contract={contractRecord}
                    proposalId={latestProposal?.id ?? ""}
                />

            </div>
        </div>
    );
}
