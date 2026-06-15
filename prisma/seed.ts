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

    const agencyMembership = await prisma.agencyMembership.upsert({
        where: {
            userId_organizationId: {
                userId: admin.id,
                organizationId: organization.id,
            },
        },
        update: {
            role: "owner",
            active: true,
        },
        create: {
            userId: admin.id,
            organizationId: organization.id,
            role: "owner",
            active: true,
        },
        select: { id: true, role: true, active: true },
    });

    await prisma.organizationAccess.upsert({
        where: {
            agencyMembershipId_organizationId: {
                agencyMembershipId: agencyMembership.id,
                organizationId: organization.id,
            },
        },
        update: { active: true },
        create: {
            agencyMembershipId: agencyMembership.id,
            organizationId: organization.id,
            active: true,
        },
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
        agencyRole: agencyMembership.role,
        agencyActive: agencyMembership.active,
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
