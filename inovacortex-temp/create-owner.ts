import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log("Creating default owner user...");

    // Create org if missing
    let org = await prisma.organization.findUnique({ where: { slug: 'inovacortex' } });
    if (!org) {
        org = await prisma.organization.create({
            data: {
                name: 'InovaCortex',
                slug: 'inovacortex',
                plan: 'enterprise'
            }
        });
        console.log("Created org:", org.slug);
    }

    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Upsert user
    const user = await prisma.user.upsert({
        where: { email: 'ceo@inovacortex.com' },
        update: {
            passwordHash: hashedPassword,
            role: 'owner',
            organizationId: org.id
        },
        create: {
            email: 'ceo@inovacortex.com',
            passwordHash: hashedPassword,
            role: 'owner',
            organizationId: org.id
        }
    });

    console.log("Created owner user:", user.email);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
