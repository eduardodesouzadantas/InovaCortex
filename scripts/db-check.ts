import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const orgs = await prisma.organization.findMany({
        select: { id: true, slug: true, name: true },
    });

    console.log("Organizations in DB:", orgs);

    const assessments = await prisma.assessment.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, createdAt: true },
    });

    console.log("Last 5 Assessments:", assessments);

    const count = await prisma.assessment.count();
    console.log("Total Assessments:", count);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
