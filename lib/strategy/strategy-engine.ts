import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

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

/**
 * Computes core KPIs for an organization within a given time window.
 */
export async function computeCoreKPIs(orgId: string, days: number = 30): Promise<StrategyKPIs> {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    // 1. Proposal Metrics
    const proposals = await prisma.proposal.findMany({
        where: { organizationId: orgId, createdAt: { gte: startDate } },
        select: { status: true, pricingEstimate: true, createdAt: true, updatedAt: true }
    });

    let proposalAcceptanceRate = 0;
    let pipelineVelocityDays = 0;
    let averageDealSize = 0;

    if (proposals.length > 0) {
        const accepted = proposals.filter(p => p.status === 'accepted');
        proposalAcceptanceRate = (accepted.length / proposals.length) * 100;

        if (accepted.length > 0) {
            const sumDeal = accepted.reduce((acc, p) => {
                try {
                    const pe = JSON.parse(p.pricingEstimate);
                    return acc + (pe.min || 0);
                } catch { return acc; }
            }, 0);
            averageDealSize = sumDeal / accepted.length / 100;

            const sumVelocity = accepted.reduce((acc, p) => {
                const diff = Math.abs(p.updatedAt.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                return acc + diff;
            }, 0);
            pipelineVelocityDays = sumVelocity / accepted.length;
        }
    }

    // 2. Meeting Metrics
    const scheduled = await prisma.systemEvent.count({
        where: { organizationId: orgId, type: 'meeting_scheduled', createdAt: { gte: startDate } }
    });
    const noShows = await prisma.systemEvent.count({
        where: { organizationId: orgId, type: 'meeting_no_show', createdAt: { gte: startDate } }
    });

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
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { industry: true, plan: true }
    });

    if (!org) return null;

    // Try specific segment first
    let segment = await prisma.benchmarkSegment.findFirst({
        where: {
            industry: org.industry,
            plan: org.plan,
            timeWindow: window
        },
        orderBy: { periodEnd: 'desc' },
        include: { snapshots: true }
    });

    // Fallback to industry-only or global
    if (!segment) {
        segment = await prisma.benchmarkSegment.findFirst({
            where: {
                industry: org.industry,
                timeWindow: window
            },
            orderBy: { periodEnd: 'desc' },
            include: { snapshots: true }
        }) || await prisma.benchmarkSegment.findFirst({
            where: {
                industry: 'all',
                timeWindow: window
            },
            orderBy: { periodEnd: 'desc' },
            include: { snapshots: true }
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
    const kpis = await computeCoreKPIs(orgId);
    const benchmarks = await getBenchmarks(orgId);
    const bottlenecks = detectBottlenecks(kpis, benchmarks);
    const recommendations = generateRecommendations(kpis, bottlenecks);

    return {
        kpis,
        benchmarks,
        bottlenecks,
        recommendations
    };
}
