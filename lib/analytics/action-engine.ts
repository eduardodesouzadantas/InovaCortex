import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface ActionItem {
    label: string;
    impact: string;
    impactValue?: number;
    description: string;
    priority: "high" | "medium" | "low";
}

export interface ActionResult {
    actions: ActionItem[];
}

/**
 * generateDailyActions (V32 Refined)
 * Orchestrates RevenueBrain + LeakDetector + GrowthSignals into practical tasks.
 */
export async function generateDailyActions(orgId: string): Promise<ActionResult> {
    try {
        const { computeRevenueOpportunities } = await import("./revenue-brain");
        const { scanRevenueLeaks } = await import("./leak-detector");

        const [revenue, leaks, growthSignals, marketingToday] = await Promise.all([
            computeRevenueOpportunities(orgId),
            scanRevenueLeaks(orgId),
            (prisma as any).growthSignal.findMany({
                where: { organizationId: orgId, actionTaken: false },
                orderBy: { createdAt: "desc" },
                take: 5
            }),
            (prisma as any).marketingPlan.findFirst({
                where: {
                    orgId,
                    status: "approved",
                    scheduledFor: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                        lte: new Date(new Date().setHours(23, 59, 59, 999))
                    }
                }
            })
        ]);

        const actions: ActionItem[] = [];

        // 1. Revenue Actions (Deals Quentes)
        revenue.highProbabilityDeals.forEach(deal => {
            actions.push({
                label: `Follow-up: Proposta ${deal.email.split('@')[0]}`,
                impact: `Alta Probabilidade (R$ ${(deal.value / 100).toLocaleString('pt-BR')})`,
                impactValue: deal.value,
                description: `Oportunidade com ${Math.round(deal.probability * 100)}% de chance de fechamento.`,
                priority: "high"
            });
        });

        // 2. Leak Actions (Reagendamentos e Follow-ups parados)
        leaks.leakItems.filter(l => l.potentialLoss > 500000).forEach(leak => {
            actions.push({
                label: `Intervir: ${leak.label}`,
                impact: `Vazamento de Receita (${leak.value})`,
                impactValue: leak.potentialLoss,
                description: leak.description,
                priority: "high"
            });
        });

        // 3. Growth Actions (Sinais de interesse)
        growthSignals.forEach((signal: any) => {
            actions.push({
                label: `Responder: ${signal.type.replace('_', ' ')}`,
                impact: "Geração de Leads",
                description: signal.message,
                priority: "medium"
            });
        });

        // 4. Content/Marketing Actions
        if (marketingToday) {
            actions.push({
                label: `Aprovar/Postar: ${marketingToday.topic}`,
                impact: "Autoridade & Atração",
                description: `Publicação agendada para ${marketingToday.platform}.`,
                priority: "medium"
            });
        }

        // Sort by impactValue if available, or priority
        const sortedActions = actions.sort((a, b) => {
            if (a.impactValue && b.impactValue) return b.impactValue - a.impactValue;
            if (a.priority === "high" && b.priority !== "high") return -1;
            if (a.priority !== "high" && b.priority === "high") return 1;
            return 0;
        });

        return {
            actions: sortedActions.slice(0, 7)
        };

    } catch (error: any) {
        logger.error("generateDailyActions failed", { orgId, error: error.message });
        throw error;
    }
}

/**
 * Legacy support for computeDailyActions
 */
export async function computeDailyActions(orgId: string) {
    // Re-using the logic or keeping it for now to avoid breaking changes if called elsewhere
    // but the target is generateDailyActions
    const result = await generateDailyActions(orgId);
    return {
        totalPendingActions: result.actions.length,
        criticalActions: result.actions.filter(a => a.priority === "high").map(a => a.label),
        todayMeetings: [], // Needs separate query if needed in legacy
        blockedTasks: [],
        marketingToday: [],
        recommendations: result.actions.map(a => a.description)
    };
}
