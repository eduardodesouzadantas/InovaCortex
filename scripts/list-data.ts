import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    take: 5,
    select: { id: true, email: true, role: true, organizationId: true }
  });
  console.log("USERS:", JSON.stringify(users, null, 2));

  const orgs = await prisma.organization.findMany({
    take: 5,
    select: { id: true, slug: true }
  });
  console.log("ORGS:", JSON.stringify(orgs, null, 2));

  const workspaces = await (prisma as any).clientWorkspace.findMany({
    take: 5,
    select: { id: true, organizationId: true }
  });
  console.log("WORKSPACES:", JSON.stringify(workspaces, null, 2));

  const assessments = await (prisma as any).assessment.findMany({
    take: 5,
    select: { id: true, organizationId: true }
  });
  console.log("ASSESSMENTS:", JSON.stringify(assessments, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
