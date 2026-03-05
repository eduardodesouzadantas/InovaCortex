import { prisma } from "./lib/prisma";

async function main() {
    const org = await prisma.organization.findFirst();
    const lead = await prisma.assessment.findFirst();
    console.log(JSON.stringify({ org, lead }));
}

main();
