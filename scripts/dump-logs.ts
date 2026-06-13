import { prisma } from '../lib/prisma';

async function main() {
    const logs = await (prisma as any).messageLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    console.log(JSON.stringify(logs, null, 2));
}

main().finally(() => prisma.$disconnect());
