import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const latestAssessment = await prisma.assessment.findFirst({
        orderBy: { createdAt: 'desc' }
    })
    console.log("Latest Assessment:", latestAssessment?.name, latestAssessment?.phone, latestAssessment?.whatsappConsent);

    if (latestAssessment) {
        try {
            const logs = await (prisma as any).messageLog.findMany({
                where: { assessmentId: latestAssessment.id }
            })
            console.log("Message Logs for Assessment:");
            console.dir(logs, { depth: null });
        } catch (e) {
            console.log("MessageLog check failed:", e);
        }
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
