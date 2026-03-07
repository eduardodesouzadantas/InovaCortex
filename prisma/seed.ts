import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Starting initial seed...");

    // 1. Create Default Organization
    const defaultOrgId = "default-org-id";
    const organization = await prisma.organization.upsert({
        where: { id: defaultOrgId },
        update: {},
        create: {
            id: defaultOrgId,
            name: "InovaCortex",
            slug: "inovacortex",
            plan: "enterprise",
            industry: "Technology",
            maxAssessmentsPerMonth: 1000,
            maxUsers: 100,
        },
    });
    console.log(`✅ Organization created/verified: ${organization.slug}`);

    // 2. Create Initial Admin User
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || "admin@inovacortex.com";
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || "admin123";
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            passwordHash: hashedPassword,
            role: "admin",
            organizationId: organization.id,
        },
    });
    console.log(`✅ Admin user created/verified: ${admin.email}`);

    // 3. Initial System Settings
    const settings = [
        { key: "system_status", value: "active" },
        { key: "ai_model_default", value: "gpt-4o" },
        { key: "learning_mode", value: "enabled" },
    ];

    for (const setting of settings) {
        await prisma.systemSetting.upsert({
            where: {
                key_organizationId: {
                    key: setting.key,
                    organizationId: organization.id,
                },
            },
            update: {},
            create: {
                key: setting.key,
                value: setting.value,
                organizationId: organization.id,
            },
        });
    }
    console.log("✅ Basic system settings initialized.");

    console.log("✨ Seed completed successfully.");
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:");
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
