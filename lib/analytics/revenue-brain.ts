import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface RevenueOpportunityResult {
    totalOpportunity: number;
    highProbabilityDeals: { id: string; email: string; value: number; probability: number }[];
    stalledDeals: { id: string; email: string; daysSinceLastContact: number }[];
    fastWins: string[];
    recommendations: string[];
}

/**
 * Revenue Brain (V32)
 * Analyzes the pipeline to find "Money on the Table".
 */
export async function computeRevenueOpportunities(orgId: string): Promise<RevenueOpportunityResult> {
    try {
        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

        // 1. High Probability Deals (Meeting Sessions with adjusted probability >= 70%)
        const highProbMeetings = await (prisma as any).meetingSession.findMany({
            where: {
                organizationId: orgId,
                status: { in: ["scheduled", "completed"] },
                adjustedProbability: { gte: 0.7 },
            },
            select: {
                id: true,
                leadEmail: true,
                expectedRevenue: true,
                adjustedProbability: true,
            },
            orderBy: { adjustedProbability: "desc" },
        });

        // 2. Open Proposals (Sent or Viewed)
        const openProposals = await (prisma as any).proposal.findMany({
            where: {
                organizationId: orgId,
                status: { in: ["sent", "viewed"] },
            },
            include: {
                assessment: {
                    select: { email: true }
                }
            }
        });

        // 3. Stalled Leads (LeadSequences with no message in 3 days)
        const stalledSequences = await (prisma as any).leadSequence.findMany({
            where: {
                organizationId: orgId,
                status: "active",
                lastMessageAt: { lt: threeDaysAgo },
            },
            select: {
                id: true,
                assessmentId: true,
                lastMessageAt: true,
            },
            take: 10,
        });

        // Resolve emails for stalled leads
        const stalledLeads = await Promise.all(stalledSequences.map(async (s: any) => {
            const assessment = await (prisma as any).assessment.findUnique({
                where: { id: s.assessmentId },
                select: { email: true }
            });
            const diffMs = now.getTime() - new Date(s.lastMessageAt).getTime();
            return {
                id: s.id,
                email: assessment?.email || "unknown",
                daysSinceLastContact: Math.floor(diffMs / (1000 * 60 * 60 * 24))
            };
        }));

        // 4. Benchmark Analysis (V30 integration)
        const org = await (prisma as any).organization.findUnique({
            where: { id: orgId },
            select: { industry: true }
        });

        const industryBenchmarks = await (prisma as any).benchmarkSnapshot.findFirst({
            where: {
                segment: {
                    industry: org?.industry || "Services",
                    timeWindow: "30d"
                }
            },
            orderBy: { createdAt: "desc" }
        });

        const metrics = industryBenchmarks?.metrics ? JSON.parse(industryBenchmarks.metrics) : null;
        const isHighPerformingIndustry = metrics?.proposalAcceptanceRate > 0.4; // 40%+ is high

        // 5. Build Recommendations
        const recommendations: string[] = [];
        const fastWins: string[] = [];

        if (highProbMeetings.length > 0) {
            recommendations.push(`Priorizar fechamento de ${highProbMeetings.length} reuniões com >70% de probabilidade.`);
            fastWins.push(`${highProbMeetings.length} Reuniões Hot`);
        }

        if (stalledLeads.length > 0) {
            recommendations.push(`Enviar follow-up manual para ${stalledLeads.length} leads parados há mais de 3 dias.`);
        }

        if (openProposals.length > 0) {
            const viewed = openProposals.filter((p: any) => p.status === "viewed");
            if (viewed.length > 0) {
                recommendations.push(`${viewed.length} propostas foram visualizadas. Ligar para tirar dúvidas agora.`);
            }
        }

        if (isHighPerformingIndustry) {
            recommendations.push(`O segmento "${org?.industry}" está convertendo 40% acima da média nacional. Foque em outbound para este nicho.`);
        }

        const totalOpportunity = highProbMeetings.reduce((acc: number, m: any) => acc + (m.expectedRevenue || 0), 0);

        return {
            totalOpportunity,
            highProbabilityDeals: highProbMeetings.map((m: any) => ({
                id: m.id,
                email: m.leadEmail,
                value: m.expectedRevenue || 0,
                probability: m.adjustedProbability || 0
            })),
            stalledDeals: stalledLeads,
            fastWins,
            recommendations
        };

    } catch (error: any) {
        logger.error("Revenue Brain calculation failed", { orgId, error: error.message });
        throw error;
    }
}
