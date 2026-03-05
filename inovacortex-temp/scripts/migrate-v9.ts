/**
 * scripts/migrate-v9.ts
 * V9 Data Migration: Create default Organization and User, associate existing data.
 *
 * Run:
 *   npx ts-node --project tsconfig.json scripts/migrate-v9.ts
 *
 * What it does:
 *   1. Creates Organization with id="default-org-id", slug="inovacortex"
 *   2. Creates default User (owner) from ENV credentials (hashed password)
 *   3. Reports counts of associated records
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_ORG_ID = "default-org-id";
const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORG_SLUG ?? "inovacortex";
const DEFAULT_ORG_NAME = process.env.DEFAULT_ORG_NAME ?? "InovaCortex";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "eduardo@inovacortex.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "M@ncha07";

async function main() {
    console.log("🚀  V9 Migration Script starting...\n");

    // 1. Create default Organization
    const existingOrg = await (prisma as any).organization.findFirst({
        where: { id: DEFAULT_ORG_ID }
    });

    let org: any;
    if (existingOrg) {
        console.log(`✅  Organization already exists: ${existingOrg.slug}`);
        org = existingOrg;
    } else {
        org = await (prisma as any).organization.create({
            data: {
                id: DEFAULT_ORG_ID,
                name: DEFAULT_ORG_NAME,
                slug: DEFAULT_ORG_SLUG,
                plan: "enterprise",
                maxAssessmentsPerMonth: 999,
                maxUsers: 10,
            }
        });
        console.log(`✅  Organization created: ${org.slug} (id: ${org.id})`);
    }

    // 2. Create default Owner User
    const existingUser = await (prisma as any).user.findUnique({
        where: { email: ADMIN_EMAIL }
    });

    if (existingUser) {
        console.log(`✅  User already exists: ${existingUser.email} (role: ${existingUser.role})`);
    } else {
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
        const user = await (prisma as any).user.create({
            data: {
                email: ADMIN_EMAIL,
                passwordHash,
                role: "owner",
                organizationId: DEFAULT_ORG_ID,
            }
        });
        console.log(`✅  User created: ${user.email} (role: ${user.role})`);
    }

    // 3. Report existing data counts
    const [assessments, proposals, auditEvents, aiInvocations, systemSettings] = await Promise.all([
        (prisma as any).assessment.count({ where: { organizationId: DEFAULT_ORG_ID } }),
        (prisma as any).proposal.count({ where: { organizationId: DEFAULT_ORG_ID } }),
        (prisma as any).auditEvent.count({ where: { organizationId: DEFAULT_ORG_ID } }),
        (prisma as any).aIInvocation.count({ where: { organizationId: DEFAULT_ORG_ID } }),
        (prisma as any).systemSetting.count({ where: { organizationId: DEFAULT_ORG_ID } }),
    ]);

    console.log("\n📊  Associated records:");
    console.log(`   Assessments:    ${assessments}`);
    console.log(`   Proposals:      ${proposals}`);
    console.log(`   Audit Events:   ${auditEvents}`);
    console.log(`   AI Invocations: ${aiInvocations}`);
    console.log(`   System Settings:${systemSettings}`);

    console.log(`\n🎉  Migration complete! Access your admin at:`);
    console.log(`   http://localhost:3000/org/${DEFAULT_ORG_SLUG}/admin\n`);
}

main()
    .catch(e => { console.error("Migration failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
