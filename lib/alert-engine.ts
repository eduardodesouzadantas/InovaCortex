/**
 * lib/alert-engine.ts
 * V27: CEO Command Center Anomaly Detector
 * Scans the database for operational stalled states and issues SystemEvents.
 */

import { prisma } from "@/lib/prisma";
import { logSystemEvent } from "./system-events";
import { logger } from "./logger";

export async function runAnomalyDetectionSweep(orgId: string) {
    logger.info(`Running Anomaly Detection Sweep for org: ${orgId}`);
    const now = new Date();

    // 1. Detect Stale Leads (> 48h since assessment, no meeting, status = "Novo")
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const staleAssessments = await prisma.assessment.findMany({
        where: {
            organizationId: orgId,
            status: 'Novo',
            createdAt: { lt: twoDaysAgo }
        }
    });

    for (const lead of staleAssessments) {
        // Check if we already alerted
        const existing = await (prisma as any).systemEvent.findFirst({
            where: { orgId, type: 'profit_leak_detected', entityId: lead.id }
        });

        if (!existing) {
            await logSystemEvent({
                organizationId: orgId,
                type: 'profit_leak_detected',
                entityType: 'Assessment',
                entityId: lead.id,
                payload: {
                    title: 'Lead Stale > 48h',
                    description: `Lead ${lead.name} (${lead.company}) was captured over 48 hours ago but remains uncontacted.`,
                    estimatedLossCents: 150000 // Placeholder inferred penalty
                }
            });
        }
    }

    // 2. Open Proposals (> 5 days)
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const openProposals = await prisma.proposal.findMany({
        where: {
            organizationId: orgId,
            status: { in: ['sent', 'viewed'] },
            createdAt: { lt: fiveDaysAgo }
        },
        include: { assessment: true }
    });

    for (const proposal of openProposals) {
        const existing = await (prisma as any).systemEvent.findFirst({
            where: { orgId, type: 'profit_leak_detected', entityId: proposal.id }
        });

        if (!existing) {
            await logSystemEvent({
                organizationId: orgId,
                type: 'profit_leak_detected',
                entityType: 'Proposal',
                entityId: proposal.id,
                payload: {
                    title: 'Proposal Stalled > 5 Days',
                    description: `Proposal to ${proposal.assessment.company} has been pending without signature for 5+ days.`,
                    severity: 'high'
                }
            });
        }
    }

    // 3. Stalled Provisioning (Paid but no active workspace)
    const stalledWorkspaces = await prisma.clientWorkspace.findMany({
        where: {
            organizationId: orgId,
            status: 'provisioning',
            createdAt: { lt: twoDaysAgo }
        }
    });

    for (const ws of stalledWorkspaces) {
        const existing = await (prisma as any).systemEvent.findFirst({
            where: { orgId, type: 'profit_leak_detected', entityId: ws.id }
        });

        if (!existing) {
            await logSystemEvent({
                organizationId: orgId,
                type: 'profit_leak_detected',
                entityType: 'ClientWorkspace',
                entityId: ws.id,
                payload: {
                    title: 'Workspace Provisioning Stuck',
                    description: `A closed deal is stuck in provisioning for over 48h. Client onboarding delayed.`,
                    severity: 'critical'
                }
            });
        }
    }

    return { message: "Sweep complete" };
}
