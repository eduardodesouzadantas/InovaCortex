import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const latestAssessment = await prisma.assessment.findFirst({
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            name: true,
            phone: true,
            whatsappConsent: true,
        },
    });

    console.log(
        "Latest Assessment:",
        latestAssessment?.name,
        latestAssessment?.phone,
        latestAssessment?.whatsappConsent,
    );

    if (!latestAssessment) return;

    try {
        const logs = await prisma.messageLog.findMany({
            where: { assessmentId: latestAssessment.id },
        });

        console.log("Message Logs for Assessment:");
        console.dir(logs, { depth: null });
    } catch (error: unknown) {
        console.log("MessageLog check failed:", error);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
