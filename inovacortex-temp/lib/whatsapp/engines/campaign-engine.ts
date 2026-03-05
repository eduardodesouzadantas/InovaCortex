import { prisma } from "@/lib/prisma";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { logger } from "@/lib/logger";

/**
 * Sweeps the `whatsApp_campaign_sends` table for pending messages 
 * and dispatches them respecting the throttle limits.
 * In a real environment, this is called via cron or a queue processor.
 */
export async function queueCampaignBatch(orgId: string, limit: number = 50) {
    const pendingSends = await prisma.whatsAppCampaignSend.findMany({
        where: {
            campaign: { organizationId: orgId, status: "running" },
            status: "pending"
        },
        include: {
            contact: true,
            campaign: { include: { template: true } }
        },
        take: limit
    });

    if (pendingSends.length === 0) return 0;

    let sentCount = 0;

    for (const send of pendingSends) {
        // Enforce opt-in (stub)
        const hasOptIn = await prisma.whatsAppOptIn.findUnique({ where: { contactId: send.contactId } });
        if (!hasOptIn) {
            await prisma.whatsAppCampaignSend.update({
                where: { id: send.id },
                data: { status: "failed", errorCode: "OPT_IN_REQUIRED" }
            });
            continue;
        }

        const template = send.campaign.template;
        const result = await sendWhatsAppTemplate(send.contact.phoneNumberE164, template.name, template.language, []);

        if (result.error) {
            await prisma.whatsAppCampaignSend.update({
                where: { id: send.id },
                data: { status: "failed", errorCode: result.error, sentAt: new Date() }
            });
            logger.warn(`Campaign send failed to ${send.contact.phoneNumberE164}`, { error: result.error });
        } else {
            await prisma.whatsAppCampaignSend.update({
                where: { id: send.id },
                data: { status: "sent", sentAt: new Date() }
            });

            // Log outgoing message natively as well
            await prisma.whatsAppMessage.create({
                data: {
                    conversationId: "mass_campaign", // Usually map to a thread, kept abstract for mass sends
                    messageId: result.messageId || `cmp_${send.id}`,
                    direction: "outbound",
                    type: "template",
                    status: "sent",
                    sentAt: new Date()
                }
            }).catch(() => { });

            sentCount++;
        }
    }

    // Check if campaign is finished
    const remaining = await prisma.whatsAppCampaignSend.count({
        where: { campaignId: pendingSends[0].campaignId, status: "pending" }
    });

    if (remaining === 0) {
        await prisma.whatsAppCampaign.update({
            where: { id: pendingSends[0].campaignId },
            data: { status: "completed" }
        });
    }

    return sentCount;
}
