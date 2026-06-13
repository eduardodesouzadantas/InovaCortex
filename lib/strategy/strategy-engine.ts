import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { profileStep } from "@/lib/request-profiler";

export interface StrategyKPIs {
    proposalAcceptanceRate: number;
    pipelineVelocityDays: number;
    averageDealSize: number;
    meetingShowRate: number;
}

export interface Bottleneck {
    type: "acceptance" | "velocity" | "deal_size" | "show_rate";
    severity: "critical" | "warning";
    currentValue: number;
    benchmarkValue: number;
    gap: number;
}

export interface Recommendation {
    type: string;
    title: string;
    summary: string;
    evidence: any[];
    impactScore: number;
    effortScore: number;
    roiCents?: number;
}

export interface StrategyAnalysisResult {
    kpis: StrategyKPIs;
    benchmarks: any;
    bottlenecks: Bottleneck[];
    recommendations: Recommendation[];
}

const STRATEGY_ANALYSIS_CACHE_TTL_MS = 60_000;
const strategyAnalysisCache = new Map<string, { expiresAt: number; value: StrategyAnalysisResult }>();

/**
 * Computes core KPIs for an organization within a given time window.
 */
export async function computeCoreKPIs(orgId: string, days: number = 30): Promise<StrategyKPIs> {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const [proposalCount, acceptedProposals, meetingEvents] = await Promise.all([
        profileStep("strategy.kpis.proposal_count", () =>
            prisma.proposal.count({
                where: { organizationId: orgId, createdAt: { gte: startDate } },
            })),
        profileStep("strategy.kpis.accepted_proposals", () =>
            prisma.proposal.findMany({
                where: {
                    organizationId: orgId,
                    createdAt: { gte: startDate },
                    status: "accepted",
                },
                select: { pricingEstimate: true, createdAt: true, updatedAt: true },
            })),
        profileStep("strategy.kpis.meeting_events", () =>
            prisma.systemEvent.groupBy({
                by: ["type"],
                where: {
                    organizationId: orgId,
                    type: { in: ["meeting_scheduled", "meeting_no_show"] },
                    createdAt: { gte: startDate },
                },
                _count: { _all: true },
            })),
    ]);

    let proposalAcceptanceRate = 0;
    let pipelineVelocityDays = 0;
    let averageDealSize = 0;

    if (proposalCount > 0) {
        proposalAcceptanceRate = (acceptedProposals.length / proposalCount) * 100;
    }

    if (acceptedProposals.length > 0) {
        const sumDeal = acceptedProposals.reduce((acc, p) => {
            try {
                const pe = JSON.parse(p.pricingEstimate);
                return acc + (pe.min || 0);
            } catch { return acc; }
        }, 0);
        averageDealSize = sumDeal / acceptedProposals.length / 100;

        const sumVelocity = acceptedProposals.reduce((acc, p) => {
            const diff = Math.abs(p.updatedAt.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            return acc + diff;
        }, 0);
        pipelineVelocityDays = sumVelocity / acceptedProposals.length;
    }

    const scheduled = meetingEvents.find((event) => event.type === "meeting_scheduled")?._count._all ?? 0;
    const noShows = meetingEvents.find((event) => event.type === "meeting_no_show")?._count._all ?? 0;

    let meetingShowRate = 0;
    if (scheduled > 0) {
        meetingShowRate = ((scheduled - noShows) / scheduled) * 100;
    }

    return {
        proposalAcceptanceRate,
        pipelineVelocityDays,
        averageDealSize,
        meetingShowRate
    };
}

/**
 * Fetches relevant benchmarks for the organization.
 */
export async function getBenchmarks(orgId: string, window: string = "30d") {
    const org = await profileStep("strategy.benchmarks.org", () =>
        prisma.organization.findUnique({
            where: { id: orgId },
            select: { industry: true, plan: true },
        }));

    if (!org) return null;

    // Try specific segment first
    let segment = await profileStep("strategy.benchmarks.segment_specific", () =>
        prisma.benchmarkSegment.findFirst({
            where: {
                industry: org.industry,
                plan: org.plan,
                timeWindow: window,
            },
            orderBy: { periodEnd: "desc" },
            select: { snapshots: { select: { metrics: true } } },
        }));

    // Fallback to industry-only or global
    if (!segment) {
        segment = await profileStep("strategy.benchmarks.segment_fallback", async () => {
            const industrySegment = await prisma.benchmarkSegment.findFirst({
                where: {
                    industry: org.industry,
                    timeWindow: window,
                },
                orderBy: { periodEnd: "desc" },
                select: { snapshots: { select: { metrics: true } } },
            });

            if (industrySegment) {
                return industrySegment;
            }

            return prisma.benchmarkSegment.findFirst({
                where: {
                    industry: "all",
                    timeWindow: window,
                },
                orderBy: { periodEnd: "desc" },
                select: { snapshots: { select: { metrics: true } } },
            });
        });
    }

    if (!segment || !segment.snapshots) return null;

    try {
        return JSON.parse((segment.snapshots as any).metrics);
    } catch {
        return null;
    }
}

/**
 * Detects bottlenecks by comparing KPIs to benchmarks.
 */
export function detectBottlenecks(kpis: StrategyKPIs, benchmarks: any): Bottleneck[] {
    if (!benchmarks) return [];

    const bottlenecks: Bottleneck[] = [];

    // Acceptance Rate
    if (kpis.proposalAcceptanceRate < benchmarks.proposalAcceptanceRate * 0.9) {
        bottlenecks.push({
            type: "acceptance",
            severity: kpis.proposalAcceptanceRate < benchmarks.proposalAcceptanceRate * 0.6 ? "critical" : "warning",
            currentValue: kpis.proposalAcceptanceRate,
            benchmarkValue: benchmarks.proposalAcceptanceRate,
            gap: benchmarks.proposalAcceptanceRate - kpis.proposalAcceptanceRate
        });
    }

    // Pipeline Velocity (higher is worse)
    if (kpis.pipelineVelocityDays > benchmarks.pipelineVelocityDays * 1.2) {
        bottlenecks.push({
            type: "velocity",
            severity: kpis.pipelineVelocityDays > benchmarks.pipelineVelocityDays * 1.5 ? "critical" : "warning",
            currentValue: kpis.pipelineVelocityDays,
            benchmarkValue: benchmarks.pipelineVelocityDays,
            gap: kpis.pipelineVelocityDays - benchmarks.pipelineVelocityDays
        });
    }

    // Show Rate
    if (kpis.meetingShowRate < benchmarks.meetingShowRate * 0.9) {
        bottlenecks.push({
            type: "show_rate",
            severity: kpis.meetingShowRate < benchmarks.meetingShowRate * 0.7 ? "critical" : "warning",
            currentValue: kpis.meetingShowRate,
            benchmarkValue: benchmarks.meetingShowRate,
            gap: benchmarks.meetingShowRate - kpis.meetingShowRate
        });
    }

    return bottlenecks;
}

/**
 * Generates deterministic recommendations based on detected bottlenecks.
 */
export function generateRecommendations(kpis: StrategyKPIs, bottlenecks: Bottleneck[]): Recommendation[] {
    const recs: Recommendation[] = [];

    for (const b of bottlenecks) {
        if (b.type === 'acceptance') {
            recs.push({
                type: "revenue",
                title: "Otimizar Funil de Conversão",
                summary: `Sua taxa de aceite (${b.currentValue.toFixed(1)}%) está abaixo do mercado (${b.benchmarkValue.toFixed(1)}%). Recomendamos revisar a estrutura de preços ou adicionar argumentos de prova social nas propostas.`,
                evidence: [{ type: "acceptance_gap", gap: b.gap }],
                impactScore: 8,
                effortScore: 4,
                roiCents: 500000 // Placeholder
            });
        }

        if (b.type === 'show_rate') {
            recs.push({
                type: "delivery",
                title: "Reduzir No-Shows em Reuniões",
                summary: `A taxa de comparecimento está em ${b.currentValue.toFixed(1)}%. Implementar um fluxo de lembretes via WhatsApp 1h antes da reunião pode aumentar o faturamento imediato.`,
                evidence: [{ type: "show_rate_gap", gap: b.gap }],
                impactScore: 9,
                effortScore: 2,
                roiCents: 200000
            });
        }

        if (b.type === 'velocity') {
            recs.push({
                type: "outbound",
                title: "Acelerar Ciclo de Vendas",
                summary: `Seu ciclo de ${b.currentValue.toFixed(1)} dias é mais lento que a média (${b.benchmarkValue.toFixed(1)} dias). Experimente oferecer um desconto agressivo por fechamento em 48h.`,
                evidence: [{ type: "velocity_gap", gap: b.gap }],
                impactScore: 7,
                effortScore: 3,
                roiCents: 150000
            });
        }
    }

    return recs;
}

/**
 * Entry point for Strategy Engine.
 */
export async function runStrategyAnalysis(orgId: string) {
    const cached = strategyAnalysisCache.get(orgId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    const [kpis, benchmarks] = await Promise.all([
        profileStep("strategy.compute_kpis", () => computeCoreKPIs(orgId)),
        profileStep("strategy.get_benchmarks", () => getBenchmarks(orgId)),
    ]);
    const bottlenecks = detectBottlenecks(kpis, benchmarks);
    const recommendations = generateRecommendations(kpis, bottlenecks);

    const result = {
        kpis,
        benchmarks,
        bottlenecks,
        recommendations,
    };

    strategyAnalysisCache.set(orgId, {
        value: result,
        expiresAt: Date.now() + STRATEGY_ANALYSIS_CACHE_TTL_MS,
    });

    return result;
}

export async function recalculateStrategyAnalysis(orgId: string): Promise<StrategyAnalysisResult> {
    strategyAnalysisCache.delete(orgId);
    const result = await runStrategyAnalysis(orgId);
    logger.info("[StrategyEngine] recalc complete", { orgId, recommendationCount: result.recommendations.length });
    return result;
}
