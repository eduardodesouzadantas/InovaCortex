const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const report = await prisma.artifactReport.findFirst({ orderBy: { createdAt: 'desc' } });
    console.log("publicSlug:", report.publicSlug);
}

main().catch(console.error).finally(() => prisma.$disconnect());
