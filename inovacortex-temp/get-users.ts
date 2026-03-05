import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: { organization: true }
    });
    console.log("USERS IN BASE:");
    users.forEach(u => {
        console.log(`- Email: ${u.email} | Role: ${u.role} | Org: ${u.organization.slug}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
