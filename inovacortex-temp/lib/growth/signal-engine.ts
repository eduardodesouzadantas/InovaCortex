/**
 * lib/growth/signal-engine.ts
 * V28: Growth Signal & Deal Accelerator Engine
 * 
 * Constantly evaluates SystemEvents to generate GrowthSignals,
 * which in turn can trigger autonomous deal acceleration (ActionQueue limits).
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function detectGrowthSignals(orgId: string) {
    logger.info(`Running Growth Signal detection for org: ${orgId}`);

    // Look for unprocessed high-value system events in the last 24h
    const recentEvents = await prisma.systemEvent.findMany({
        where: {
            organizationId: orgId,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    const generatedSignals = [];

    for (const event of recentEvents) {
        let type = '';
        let severity = 'low';
        let message = '';

        // Map System Events to Signals
        if (event.type === 'proposal_viewed') {
            type = 'proposal_viewed';
            severity = 'high';
            message = `O Lead acessou a proposta ${event.entityId}. Hora de follow-up.`;
        }
        else if (event.type === 'workspace_provisioned') {
            type = 'workspace_completed';
            severity = 'medium';
            message = `Onboarding concluído para ${event.entityId}. Pedir depoimento/indicação.`;
        }
        // Assume outbound_reply is processed directly by the handleOutboundReply function, 
        // but just in case we have system events for it here.

        if (type) {
            // Deduplicate: Don't create the same signal for the same entity id if not taken action yet
            const existing = await prisma.growthSignal.findFirst({
                where: {
                    organizationId: orgId,
                    type,
                    metadataJson: JSON.stringify({ sourceEventId: event.id })
                }
            });

            if (!existing) {
                const signal = await prisma.growthSignal.create({
                    data: {
                        organizationId: orgId,
                        type,
                        severity,
                        message,
                        metadataJson: JSON.stringify({ sourceEventId: event.id, entityId: event.entityId })
                    }
                });
                generatedSignals.push(signal);

                // --- DEAL ACCELERATOR INTEGRATION ---
                await runDealAccelerator(signal);
            }
        }
    }

    logger.info(`Detected ${generatedSignals.length} new growth signals.`);
    return generatedSignals;
}

/**
 * Deal Accelerator: Automatically enqueues responses or follow-ups based on signals
 */
async function runDealAccelerator(signal: any) {
    if (signal.type === 'proposal_viewed' && signal.severity === 'high') {
        // Trigger an action to send a WhatsApp check-in
        await (prisma as any).actionQueue.create({
            data: {
                organizationId: signal.organizationId,
                type: 'send_whatsapp',
                priority: 'high',
                payloadJson: JSON.stringify({
                    template: "proposal_opened_followup",
                    entityId: JSON.parse(signal.metadataJson || "{}").entityId
                }),
                approvalRequired: true // Human must override/approve this automatic touch
            }
        });

        // Mark signal acted upon
        await prisma.growthSignal.update({ where: { id: signal.id }, data: { actionTaken: true } });
    }
}
