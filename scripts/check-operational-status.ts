import { prisma } from '../lib/prisma';

async function main() {
    console.log("--- Checking WhatsApp Operational Status ---");
    
    const latestConv = await prisma.whatsAppConversation.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: { contact: true }
    });
    console.log('Latest Conv:', {
        id: latestConv?.id,
        status: latestConv?.status,
        phone: latestConv?.contact?.phoneNumberE164,
        updatedAt: latestConv?.updatedAt
    });

    const latestMsg = await prisma.whatsAppMessage.findFirst({
        orderBy: { createdAt: 'desc' }
    });
    console.log('Latest Msg:', {
        id: latestMsg?.id,
        direction: latestMsg?.direction,
        status: latestMsg?.status,
        createdAt: latestMsg?.createdAt,
        text: latestMsg?.text?.slice(0, 50)
    });

    const latestAssessment = await prisma.assessment.findFirst({
        orderBy: { createdAt: 'desc' }
    });
    console.log('Latest Assessment:', {
        id: latestAssessment?.id,
        name: latestAssessment?.name,
        whatsappConsent: latestAssessment?.whatsappConsent,
        createdAt: latestAssessment?.createdAt
    });

    if (latestAssessment) {
        const logs = await (prisma as any).messageLog.findMany({
            where: { assessmentId: latestAssessment.id }
        });
        console.log(`Message Logs for Assessment (${latestAssessment.id}):`, logs.length);
        if (logs.length > 0) {
            console.dir(logs, { depth: null });
        }
    }
}

main()
    .catch(e => console.error("Operational check failed:", e))
    .finally(() => prisma.$disconnect());
