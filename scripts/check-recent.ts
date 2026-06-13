import { prisma } from '../lib/prisma';

async function main() {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    
    console.log(`Checking for assessments since: ${fifteenMinutesAgo.toISOString()}`);

    const newAssessments = await prisma.assessment.findMany({
        where: {
            createdAt: { gte: fifteenMinutesAgo }
        },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${newAssessments.length} new assessments.`);
    
    for (const ass of newAssessments) {
        const logs = await (prisma as any).messageLog.findMany({
            where: { assessmentId: ass.id }
        });
        console.log(`Assessment: ${ass.id} (${ass.name}) - Consent: ${ass.whatsappConsent}`);
        console.log("Logs:", JSON.stringify(logs, null, 2));
    }
}

main().finally(() => prisma.$disconnect());
