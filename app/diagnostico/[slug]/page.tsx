import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { FadeIn } from "@/components/fade-in";
import { BrainCircuit, CheckCircle2, AlertTriangle, ListChecks, ShieldCheck, Calendar } from "lucide-react";
import Link from "next/link";
import { ROIImpactCard } from "@/components/roi-impact-card";
import { calculateROI } from "@/lib/roi-engine";
import { PdfDownloadButton } from "@/components/pdf-download-button";

export const runtime = "nodejs";

// Public Dossier Page (Client-Facing)
export default async function DiagnosticoPublicoPage({
    params,
    searchParams
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ pdf?: string }>;
}) {
    const resolvedSearchParams = await searchParams;
    const resolvedParams = await params;
    const slug = resolvedParams.slug;

    // 1. Fetch data
    const report = await prisma.artifactReport.findUnique({
        where: { publicSlug: slug },
        include: { assessment: true }
    });

    if (!report) {
        notFound();
    }

    const assessment = report.assessment;
    const content = JSON.parse(report.contentJson);
    const isPdfMode = resolvedSearchParams.pdf === "true";

    // V7: ROI data
    const roiRow = await (prisma as any).roiProjection.findUnique({
        where: { assessmentId: assessment.id }
    });
    // If not yet generated (legacy leads), compute on-the-fly
    const roi = roiRow
        ? calculateROI({
            teamSize: assessment.teamSize,
            volumeDay: assessment.volumeDay,
            scoreTotal: assessment.scoreTotal,
            classification: assessment.classification,
            pains: JSON.parse(assessment.pains || "[]"),
            avgHourlyCost: roiRow.avgHourlyCost ?? undefined,
            avgTicket: roiRow.avgTicket ?? undefined,
            conversionRate: roiRow.conversionRate ?? undefined,
        })
        : calculateROI({
            teamSize: assessment.teamSize,
            volumeDay: assessment.volumeDay,
            scoreTotal: assessment.scoreTotal,
            classification: assessment.classification,
            pains: JSON.parse(assessment.pains || "[]"),
        });

    const msgWhatsApp = encodeURIComponent(`Olá, estou com meu Dossiê em mãos e gostaria de conversar sobre a estruturação da minha automação.`);

    return (
        <div className="min-h-screen bg-background text-foreground pb-24">
            {/* Header/Hero Section */}
            <header className="pt-24 pb-12 bg-muted/10 border-b border-border/50">
                <div className="max-w-4xl mx-auto px-6">
                    <FadeIn delay={0.1}>
                        <div className="flex items-center gap-3 mb-6">
                            <BrainCircuit className="w-8 h-8 text-primary" />
                            <span className="font-excalibur text-xl tracking-tight">InovaCortex</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
                            Dossiê de Diagnóstico Técnico
                        </h1>
                        <p className="text-xl text-muted-foreground">
                            Análise de Infraestrutura para <strong>{assessment.company}</strong>
                        </p>
                        <div className="flex items-center gap-4 mt-8 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Gerado em: {assessment.createdAt.toLocaleDateString('pt-BR')}</span>
                            <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Hash: {slug.substring(0, 8)}</span>
                        </div>
                    </FadeIn>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12 space-y-16">

                {/* Score Section */}
                <FadeIn delay={0.2}>
                    <section className="grid md:grid-cols-2 gap-8">
                        <div className="glass-panel p-8 rounded-2xl border border-primary/20 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent"></div>
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Potencial de Automação</h3>
                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-6xl font-black text-gradient leading-none">{assessment.scoreTotal}</span>
                                <span className="text-2xl text-muted-foreground pb-1">/100</span>
                            </div>
                            <p className="text-lg font-bold text-foreground mt-4">{assessment.classification}</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                Esta pontuação reflete a viabilidade arquitetural e o impacto financeiro de implementar IA na operação atual.
                            </p>
                        </div>

                        <div className="glass-panel p-8 rounded-2xl border border-border/50">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Foco Inicial (Missões)</h3>
                            <ul className="space-y-4">
                                {JSON.parse(assessment.recommendedMissions).map((mission: string, i: number) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                        <span className="font-medium">{mission}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>
                </FadeIn>

                {/* Blueprint Section */}
                <FadeIn delay={0.3}>
                    <section>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <BrainCircuit className="w-6 h-6 text-primary" />
                            Blueprint da Solução Recomendada
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-muted/30 p-6 rounded-xl border border-border/50">
                                <h4 className="font-semibold mb-3">Módulos Inteligentes</h4>
                                <ul className="space-y-2">
                                    {content.blueprint.modules.map((mod: string, i: number) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/50"></div>
                                            {mod}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-muted/30 p-6 rounded-xl border border-border/50">
                                <h4 className="font-semibold mb-3">Conexões Mapeadas</h4>
                                <ul className="space-y-2">
                                    {content.blueprint.integrations.map((int: string, i: number) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <div className="w-1.5 h-1.5 rounded-full bg-accent/50"></div>
                                            {int}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>
                </FadeIn>

                {/* Roadmap Section */}
                <FadeIn delay={0.4}>
                    <section>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <ListChecks className="w-6 h-6 text-primary" />
                            Roadmap Tático (30 Dias)
                        </h2>
                        <div className="space-y-4">
                            {content.roadmap.map((step: any, i: number) => (
                                <div key={i} className="glass-panel p-6 rounded-xl border border-border/50 flex flex-col md:flex-row gap-4 md:items-center">
                                    <div className="bg-primary/10 text-primary font-bold px-4 py-2 rounded-lg text-sm shrink-0 whitespace-nowrap">
                                        {step.phase}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">{step.title}</h4>
                                        <p className="text-muted-foreground text-sm">{step.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </FadeIn>

                {/* Risks Section */}
                <FadeIn delay={0.5}>
                    <section className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-500">
                            <AlertTriangle className="w-5 h-5" />
                            Fatores de Risco Operacional
                        </h2>
                        <p className="text-sm text-muted-foreground mb-4">
                            Identificamos os seguintes pontos de atenção para garantir o sucesso do projeto:
                        </p>
                        <ul className="space-y-3">
                            {content.risks.map((risk: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-sm font-medium">
                                    <span className="text-red-500 mt-0.5">•</span> {risk}
                                </li>
                            ))}
                        </ul>
                    </section>
                </FadeIn>

            </main>

            {/* ROI Impact Section */}
            <section className="max-w-4xl mx-auto px-6 py-12">
                <FadeIn delay={0.3}>
                    <ROIImpactCard
                        operationalSavingsEstimate={roi.operationalSavingsEstimate}
                        revenueIncreaseEstimate={roi.revenueIncreaseEstimate}
                        monthlyHoursRecovered={roi.monthlyHoursRecovered}
                        estimatedPaybackMonths={roi.estimatedPaybackMonths}
                        confidenceLevel={roi.confidenceLevel}
                        savingsRange={roi.savingsRange}
                        revenueRange={roi.revenueRange}
                        hoursRange={roi.hoursRange}
                        showDisclaimer={true}
                    />
                </FadeIn>
            </section>

            {/* Sticky Action Footer (Hidden in PDF mode) */}
            {!isPdfMode && (
                <div className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-md border-t border-border/50 p-4 z-50">
                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-muted-foreground hidden md:block">
                            Dossiê Gerado Oficialmente pela <strong>InovaCortex</strong>
                        </p>
                        <div className="flex w-full md:w-auto gap-3">
                            <PdfDownloadButton
                                slug={slug}
                                className="flex-1 md:flex-none inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
                                label="Baixar PDF"
                                title="Gerar e baixar PDF sem sair da pagina"
                            />
                            <a
                                href={`https://wa.me/5511967011133?text=${msgWhatsApp}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 md:flex-none inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground shadow transition-colors hover:bg-primary/90"
                            >
                                Agendar Diagnóstico
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Spacer for sticky footer */}
            {!isPdfMode && <div className="h-24"></div>}
        </div>
    );
}
