import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log("🔍 Verificando banco de dados Supabase...");

    // 1. Verificando Organização
    const org = await prisma.organization.findUnique({
        where: { id: 'default-org-id' }
    });
    console.log(org ? "✅ Organização padrão encontrada." : "❌ Organização padrão NÃO encontrada.");

    // 2. Verificando Administrador
    const admin = await prisma.user.findUnique({
        where: { email: 'admin@inovacortex.com' }
    });
    console.log(admin ? "✅ Usuário admin encontrado." : "❌ Usuário admin NÃO encontrado.");

    // 3. Verificando o registro de teste criado pelo subagente
    const assessment = await prisma.assessment.findFirst({
        where: { email: 'test@supabase.com' },
        orderBy: { createdAt: 'desc' }
    });

    if (assessment) {
        console.log(`✅ Registro de teste encontrado! ID: ${assessment.id}, Score: ${assessment.scoreTotal}`);
    } else {
        console.log("❌ Registro de teste 'test@supabase.com' NÃO encontrado.");
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
