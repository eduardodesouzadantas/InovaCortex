import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface LeakItem {
    label: string;
    value: string;
    potentialLoss: number;
    description: string;
}

export interface LeakResult {
    totalLeakValue: number;
    leakItems: LeakItem[];
}

/**
 * scanRevenueLeaks (V32 Refined)
 * Identifies 5 specific revenue leakage points.
 */
export async function scanRevenueLeaks(orgId: string): Promise<LeakResult> {
    try {
        const now = new Date();
        const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
        const avgTicketCents = 250000; // R$ 2.5k base context

        const leakItems: LeakItem[] = [];

        // 1. Propostas sem follow-up > 72h
        const proposalsNoFollowUp = await (prisma as any).proposal.findMany({
            where: {
                organizationId: orgId,
                status: { in: ["sent", "viewed"] },
                updatedAt: { lt: seventyTwoHoursAgo }
            },
            select: { id: true, pricingEstimate: true }
        });

        if (proposalsNoFollowUp.length > 0) {
            const loss = proposalsNoFollowUp.length * avgTicketCents;
            leakItems.push({
                label: `${proposalsNoFollowUp.length} propostas sem follow-up`,
                value: `R$ ${(loss / 100).toLocaleString('pt-BR')}`,
                potentialLoss: loss,
                description: "Propostas enviadas/visualizadas sem interação há mais de 3 dias."
            });
        }
        // 2. Leads quentes sem reunião
        const hotSequences = await (prisma as any).leadSequence.findMany({
            where: {
                organizationId: orgId,
                scoreTier: "hot",
            },
            select: { assessmentId: true },
            take: 10
        });

        let hotWithoutMeetingCount = 0;
        if (hotSequences.length > 0) {
            const hotAssessmentIds = hotSequences
                .map((sequence: { assessmentId?: string | null }) => sequence.assessmentId)
                .filter((assessmentId: string | null | undefined): assessmentId is string => Boolean(assessmentId));

            if (hotAssessmentIds.length > 0) {
                const meetingRows = await (prisma as any).meetingSession.findMany({
                    where: {
                        organizationId: orgId,
                        assessmentId: { in: hotAssessmentIds },
                    },
                    select: { assessmentId: true },
                });

                const assessmentIdsWithMeeting = new Set(
                    meetingRows
                        .map((meeting: { assessmentId?: string | null }) => meeting.assessmentId)
                        .filter((assessmentId: string | null | undefined): assessmentId is string => Boolean(assessmentId)),
                );

                hotWithoutMeetingCount = hotAssessmentIds.filter(
                    (assessmentId: string) => !assessmentIdsWithMeeting.has(assessmentId),
                ).length;
            }
        }

        if (hotWithoutMeetingCount > 0) {
            const loss = hotWithoutMeetingCount * avgTicketCents * 0.4;
            leakItems.push({
                label: `${hotWithoutMeetingCount} leads quentes sem reunião`,
                value: `R$ ${(loss / 100).toLocaleString('pt-BR')}`,
                potentialLoss: loss,
                description: "Oportunidades quentes em sequências de outbound que ainda não agendaram diagnóstico."
            });
        }

        // 3. Show-rate baixo
        const completedMeetings = await (prisma as any).meetingSession.findMany({
            where: {
                organizationId: orgId,
                status: "completed",
                startAt: { lt: now }
            },
            include: { performances: true }
        });

        if (completedMeetings.length > 5) {
            const noShows = completedMeetings.filter((m: any) =>
                m.performances.some((p: any) => p.outcome === "no_show")
            ).length;
            const showRate = ((completedMeetings.length - noShows) / completedMeetings.length) * 100;

            // Fetch benchmark
            const org = await (prisma as any).organization.findUnique({ where: { id: orgId }, select: { industry: true } });
            const benchmark = await (prisma as any).benchmarkSnapshot.findFirst({
                where: { segment: { industry: org?.industry || "Services" } },
                orderBy: { createdAt: "desc" }
            });
            const benchmarkMetrics = benchmark?.metrics ? JSON.parse(benchmark.metrics) : null;
            const marketShowRate = (benchmarkMetrics?.meetingShowRate || 0.75) * 100;

            if (showRate < marketShowRate - 5) {
                const loss = noShows * avgTicketCents * 0.2; // 20% conservative closing from meetings
                leakItems.push({
                    label: `Show Rate: ${showRate.toFixed(1)}%`,
                    value: `Mercado: ${marketShowRate.toFixed(0)}%`,
                    potentialLoss: loss,
                    description: "Taxa de comparecimento abaixo da média do setor. Sugere falha no lembrete pré-reunião."
                });
            }
        }

        // 4. Outbound sem resposta
        const stalledSequences = await (prisma as any).leadSequence.count({
            where: {
                organizationId: orgId,
                status: "active",
                lastMessageAt: { lt: seventyTwoHoursAgo }
            }
        });

        if (stalledSequences > 0) {
            leakItems.push({
                label: `${stalledSequences} sequências de outbound sem resposta`,
                value: "Tração Baixa",
                potentialLoss: stalledSequences * 10000, // R$ 100 cost per lead estimate
                description: "Leads em cadência que não interagiram nos últimos 3 dias."
            });
        }

        // 5. Tasks Bloqueadas (Operacional)
        const blockedTasks = await (prisma as any).implementationTask.count({
            where: {
                workspace: { organizationId: orgId },
                status: "blocked"
            }
        });

        if (blockedTasks > 0) {
            leakItems.push({
                label: `${blockedTasks} implementações bloqueadas`,
                value: "Risco de Churn",
                potentialLoss: blockedTasks * avgTicketCents * 0.5,
                description: "Gargalos técnicos impedindo o go-live e o faturamento recorrente."
            });
        }

        const totalLeakValue = leakItems.reduce((acc: number, item: LeakItem) => acc + item.potentialLoss, 0);

        return {
            totalLeakValue,
            leakItems
        };

    } catch (error: any) {
        logger.error("scanRevenueLeaks failed", { orgId, error: error.message });
        throw error;
    }
}
