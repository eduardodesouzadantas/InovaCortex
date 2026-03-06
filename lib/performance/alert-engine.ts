
import { prisma } from "@/lib/prisma";
import { computeRepKPIs, WindowKey } from "./stats-engine";
import { logSystemEvent } from "@/lib/system-events";
import { logger } from "@/lib/logger";

/**
 * Detects underperformance for sales reps in an organization.
 * Dispatched if rep score < 5 or replyTimeAvg > 120m.
 */
export async function detectUnderperformance(orgId: string, window: WindowKey) {
    const reps = await (prisma as any).salesRep.findMany({
        where: { organizationId: orgId, active: true }
    });

    for (const rep of reps) {
        const kpis = await computeRepKPIs(orgId, rep.id, window);

        // Thresholds: score < 5 (out of 10+) or reply time > 2 hours
        if (kpis.score < 5 || kpis.avgReplyTimeMinutes > 120) {
            await logSystemEvent({
                organizationId: orgId,
                type: "rep_performance_alert",
                entityType: "sales_rep",
                entityId: rep.id,
                payload: {
                    name: rep.name,
                    score: kpis.score,
                    replyTime: kpis.avgReplyTimeMinutes,
                    window,
                    reason: kpis.score < 5 ? "Low Performance Score" : "SLA Target Breach"
                }
            });
        }
    }
}

/**
 * Detects SLA Breaches in active WhatsApp conversations.
 */
export async function detectSLABreaches(orgId: string) {
    const breaches = await (prisma as any).whatsAppConversation.findMany({
        where: {
            organizationId: orgId,
            status: "open",
            slaDueAt: { lt: new Date() }
        },
        include: { user: true }
    });

    for (const b of breaches) {
        await logSystemEvent({
            organizationId: orgId,
            type: "sla_breach",
            entityType: "whatsapp_conversation",
            entityId: b.id,
            payload: {
                assignedTo: b.user?.name || "Unassigned",
                slaDueAt: b.slaDueAt,
                unreadCount: b.unreadCount,
                preview: b.lastMessagePreview
            }
        });
    }
}

/**
 * Detects ProfitLeaks with an assigned owner/rep via SalesAssignments.
 */
export async function detectOwnerLeaks(orgId: string) {
    const leaks = await (prisma as any).profitLeak.findMany({
        where: {
            organizationId: orgId,
            status: "open",
            estimatedLossCents: { gte: 100000 } // > R$1.000
        }
    });

    for (const leak of leaks) {
        if (!leak.entityId) continue;

        const assignment = await (prisma as any).salesAssignment.findUnique({
            where: {
                organizationId_entityType_entityId: {
                    organizationId: orgId,
                    entityType: "lead",
                    entityId: leak.entityId
                }
            },
            include: { salesRep: true }
        });

        if (assignment) {
            await logSystemEvent({
                organizationId: orgId,
                type: "leak_owner_alert",
                entityType: "profit_leak",
                entityId: leak.id,
                payload: {
                    title: leak.title,
                    impact: leak.estimatedLossCents,
                    ownerName: assignment.salesRep.name,
                    ownerId: assignment.salesRep.id
                }
            });
        }
    }
}

/**
 * Detects stale deals (proposals sent but without follow-up for 7+ days).
 */
export async function detectStaleDeals(orgId: string) {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const staleProposals = await (prisma as any).proposal.findMany({
        where: {
            organizationId: orgId,
            status: "sent",
            updatedAt: { lte: cutoff }
        }
    });

    for (const p of staleProposals) {
        await logSystemEvent({
            organizationId: orgId,
            type: "deal_stale_alert",
            entityType: "proposal",
            entityId: p.id,
            payload: {
                title: p.title || "Untitled Proposal",
                status: p.status,
                lastUpdate: p.updatedAt
            }
        });
    }
}
