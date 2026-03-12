import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const agencyOrgSlug = (process.env.AGENCY_ORG_SLUG ?? "inovacortex").trim().toLowerCase();

    const adminEmail = (
        process.env.ADMIN_EMAIL ??
        process.env.INITIAL_ADMIN_EMAIL ??
        "eduardo@inovacortex.com"
    ).trim().toLowerCase();

    const adminPassword = (
        process.env.ADMIN_PASSWORD ??
        process.env.INITIAL_ADMIN_PASSWORD ??
        "M@ncha07"
    ).trim();

    if (!adminEmail || !adminPassword) {
        throw new Error("ADMIN_EMAIL/ADMIN_PASSWORD (or INITIAL_ADMIN_*) must be set for seeding.");
    }

    const organization = await prisma.organization.upsert({
        where: { slug: agencyOrgSlug },
        update: {},
        create: {
            name: "InovaCortex",
            slug: agencyOrgSlug,
            plan: "enterprise",
            industry: "Technology",
            maxAssessmentsPerMonth: 1000,
            maxUsers: 100,
        },
        select: { id: true, slug: true },
    });

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            role: "owner",
            organizationId: organization.id,
            passwordHash,
        },
        create: {
            email: adminEmail,
            passwordHash,
            role: "owner",
            organizationId: organization.id,
        },
        select: { id: true, email: true, role: true },
    });

    await prisma.systemSetting.upsert({
        where: {
            key_organizationId: {
                key: "system_status",
                organizationId: organization.id,
            },
        },
        update: { value: "active" },
        create: {
            key: "system_status",
            value: "active",
            organizationId: organization.id,
        },
    });

    console.log("Seed completed", {
        orgSlug: organization.slug,
        adminEmail: admin.email,
        role: admin.role,
    });
}

main()
    .catch((error) => {
        console.error("Seed failed", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
