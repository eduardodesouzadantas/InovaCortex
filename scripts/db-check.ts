import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const orgs = await (prisma as any).organization.findMany();
    console.log("Organizations in DB:", orgs.map((o: any) => ({ id: o.id, slug: o.slug, name: o.name })));

    const assessments = await (prisma as any).assessment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });
    console.log("Last 5 Assessments:", assessments.map((a: any) => ({ id: a.id, email: a.email, createdAt: a.createdAt })));

    const count = await (prisma as any).assessment.count();
    console.log("Total Assessments:", count);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
