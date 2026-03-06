// seed-test-lead.mjs — inserts a test Assessment directly into the DB
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // Ensure default org exists first
    await prisma.organization.upsert({
        where: { id: "default-org-id" },
        update: {},
        create: {
            id: "default-org-id",
            slug: "inovacortex",
            name: "InovaCortex",
            plan: "starter",
        },
    });

    const lead = await prisma.assessment.create({
        data: {
            organizationId: "default-org-id",
            name: "Joao Silva",
            email: "joao@testecorp.com.br",
            company: "TesteCorp Ltda",
            role: "CTO",
            whatsappConsent: true,
            segment: "Tecnologia",
            teamSize: "11_50",
            volumeDay: "100_500",
            channels: JSON.stringify(["whatsapp", "email"]),
            stack: JSON.stringify(["crm", "automacao"]),
            pains: JSON.stringify(["tempo_resposta", "trabalho_manual", "dados_dispersos"]),
            urgency: "alta",
            goal: "Automatizar atendimento ao cliente e reduzir custos operacionais",
            scoreTotal: 75,
            scoreBreakdown: JSON.stringify({ A: 20, B: 15, C: 15, D: 15, E: 10 }),
            classification: "Alta prioridade",
            recommendedMissions: JSON.stringify(["Agente de Atendimento", "CRM Automatizado", "Dashboard de Dados"]),
            status: "Novo",
        },
    });

    console.log("SUCCESS! Test lead created:");
    console.log("  ID:", lead.id);
    console.log("  URL: http://localhost:3000/admin/" + lead.id);
}

main()
    .catch((e) => { console.error("ERROR:", e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
