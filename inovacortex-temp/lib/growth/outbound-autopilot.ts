/**
 * lib/growth/outbound-autopilot.ts
 * V28: Autonomous Outbound Engine
 * 
 * Subscribes discovered leads into active automated sequences.
 * Must respect human interactions out-of-band to prevent robot loops.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const TEMPLATE_CONSULTATIVE = `Olá {name}, acompanho o crescimento da {company} no setor de {industry}.
Notamos que empresas desse porte (- {size}) muitas vezes encontram gargalos na escala de vendas.
Desenvolvemos uma arquitetura de IA B2B que resolve isso. Faz sentido uma breve troca de ideias?`;

export async function runOutboundAutopilot(orgId: string) {
    logger.info(`Running Outbound Autopilot sweep for org: ${orgId}`);

    // 1. Ensure an active campaign exists
    let campaign = await prisma.outboundCampaign.findFirst({
        where: { organizationId: orgId, status: 'active' }
    });

    if (!campaign) {
        campaign = await prisma.outboundCampaign.create({
            data: {
                organizationId: orgId,
                name: 'Growth Autopilot Sequence 1',
                status: 'active'
            }
        });
    }

    // 2. Fetch fresh discovered prospects not yet sequenced
    const freshProspects = await prisma.prospect.findMany({
        where: {
            organizationId: orgId,
            status: 'discovered'
        },
        take: 5 // Rate limit daily volume
    });

    // 3. Draft and enroll messages
    for (const prospect of freshProspects) {
        const personalizedContent = TEMPLATE_CONSULTATIVE
            .replace('{name}', prospect.contactName || 'Diretoria')
            .replace('{company}', prospect.companyName)
            .replace('{industry}', prospect.industry || 'vossa área')
            .replace('{size}', prospect.companySize || 'vosso porte');

        // Create message
        await prisma.outboundMessage.create({
            data: {
                organizationId: orgId,
                campaignId: campaign.id,
                prospectId: prospect.id,
                content: personalizedContent,
                channel: 'linkedin',
                status: 'pending' // Worker or Cron will physically send this later
            }
        });

        // Update prospect status
        await prisma.prospect.update({
            where: { id: prospect.id },
            data: { status: 'engaged' }
        });

        // Increment stats
        await prisma.outboundCampaign.update({
            where: { id: campaign.id },
            data: { prospectsCount: { increment: 1 } }
        });
    }

    logger.info(`Enrolled ${freshProspects.length} prospects into campaign ${campaign.name}`);
    return { enrolled: freshProspects.length };
}

// Simulated webhook for detecting manual or linkedIn replies
export async function handleOutboundReply(prospectId: string, replyContent: string) {
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) return;

    // Stop automated sequence
    await prisma.prospect.update({
        where: { id: prospectId },
        data: { status: 'replied' }
    });

    // Generate a growth signal to alert the CEO to jump in
    await (prisma as any).growthSignal.create({
        data: {
            organizationId: prospect.organizationId,
            type: 'outbound_reply',
            severity: 'high',
            message: `Reply received from ${prospect.companyName}: "${replyContent.substring(0, 50)}..."`,
            metadataJson: JSON.stringify({ prospectId })
        }
    });

    // Trigger ActionQueue for immediate executive one-pager generation is handled by the Deal Accelerator listener.
}
