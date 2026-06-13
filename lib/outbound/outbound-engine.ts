/**
 * lib/outbound/outbound-engine.ts
 * V21: LinkedIn Outbound Engine — STUB-first, zero API dependency.
 *
 * Functions:
 *  1) recommendProspects(orgId, limit)    → stub prospect list
 *  2) startOutboundSequence(orgId, pid)   → create OutboundSequence
 *  3) buildMessage(orgId, pid, stage)     → rendered body + key
 *  4) sendNextOutboundStep(orgId, seqId)  → advance sequence, create OutboundMessage
 */

import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/runtime/base-url";
import {
    detectICP,
    renderTemplate,
    nextStage,
    STAGE_COOLDOWNS,
    type Stage,
    type MessageContext,
} from "./linkedin-templates";

type ProspectStub = {
    company: string;
    companySize: string;
    fullName: string;
    industry: string;
    linkedinUrl: string;
    location: string;
    title: string;
};

// ─── Stub prospect data ───────────────────────────────────────────────────────

const STUB_PROSPECTS: ProspectStub[] = [
        { fullName: "Ana Beatriz Mendes", title: "Diretora Comercial", company: "Imóveis Prime SP", industry: "imobiliaria", companySize: "11-50", location: "São Paulo, SP", linkedinUrl: "https://linkedin.com/in/stub-ana-mendes" },
        { fullName: "Ricardo Fonseca", title: "Sócio-Fundador", company: "RF Consultoria", industry: "consultoria", companySize: "1-10", location: "Rio de Janeiro, RJ", linkedinUrl: "https://linkedin.com/in/stub-ricardo-fonseca" },
        { fullName: "Dra. Camila Torres", title: "Diretora Clínica", company: "Clínica Torres Saúde", industry: "clinica", companySize: "11-50", location: "Belo Horizonte, MG", linkedinUrl: "https://linkedin.com/in/stub-camila-torres" },
        { fullName: "Marcos Henrique Lima", title: "CEO", company: "LimaTec Serviços", industry: "servicos_recorrentes", companySize: "51-200", location: "Curitiba, PR", linkedinUrl: "https://linkedin.com/in/stub-marcos-lima" },
        { fullName: "Juliana Carvalho", title: "Gerente de Operações", company: "Carvalho Imóveis", industry: "imobiliaria", companySize: "11-50", location: "Porto Alegre, RS", linkedinUrl: "https://linkedin.com/in/stub-juliana-carvalho" },
        { fullName: "Dr. Felipe Souza", title: "Proprietário", company: "Clínica Souza Estética", industry: "clinica", companySize: "1-10", location: "Florianópolis, SC", linkedinUrl: "https://linkedin.com/in/stub-felipe-souza" },
        { fullName: "Patrícia Oliveira", title: "Sócia", company: "Oliveira & Silva Consultores", industry: "consultoria", companySize: "1-10", location: "Brasília, DF", linkedinUrl: "https://linkedin.com/in/stub-patricia-oliveira" },
        { fullName: "Eduardo Martins", title: "Diretor de Expansão", company: "Incorporadora Martins", industry: "imobiliaria", companySize: "51-200", location: "Campinas, SP", linkedinUrl: "https://linkedin.com/in/stub-eduardo-martins" },
        { fullName: "Vanessa Ramos", title: "CEO", company: "Ramos Manutenção Predial", industry: "servicos_recorrentes", companySize: "11-50", location: "Salvador, BA", linkedinUrl: "https://linkedin.com/in/stub-vanessa-ramos" },
        { fullName: "Bruno Alves", title: "Sócio-Diretor", company: "Alves Advisory", industry: "consultoria", companySize: "1-10", location: "Recife, PE", linkedinUrl: "https://linkedin.com/in/stub-bruno-alves" },
        { fullName: "Fernanda Castro", title: "Gerente Geral", company: "Castro Imóveis Comerciais", industry: "imobiliaria", companySize: "11-50", location: "Fortaleza, CE", linkedinUrl: "https://linkedin.com/in/stub-fernanda-castro" },
        { fullName: "Dr. Gustavo Lima", title: "Diretor Médico", company: "Centro Médico Lima", industry: "clinica", companySize: "51-200", location: "Goiânia, GO", linkedinUrl: "https://linkedin.com/in/stub-gustavo-lima" },
        { fullName: "Roberta Nunes", title: "Fundadora", company: "Nunes Serviços Corporativos", industry: "servicos_recorrentes", companySize: "1-10", location: "Manaus, AM", linkedinUrl: "https://linkedin.com/in/stub-roberta-nunes" },
        { fullName: "Thiago Peixoto", title: "Diretor Comercial", company: "Peixoto Consultores", industry: "consultoria", companySize: "11-50", location: "Natal, RN", linkedinUrl: "https://linkedin.com/in/stub-thiago-peixoto" },
        { fullName: "Larissa Vieira", title: "Diretora-Geral", company: "Clínica Vieira Odontologia", industry: "clinica", companySize: "11-50", location: "Maceió, AL", linkedinUrl: "https://linkedin.com/in/stub-larissa-vieira" },
        { fullName: "Carlos Drummond", title: "CEO", company: "Drummond Real Estate", industry: "imobiliaria", companySize: "201-1000", location: "São Paulo, SP", linkedinUrl: "https://linkedin.com/in/stub-carlos-drummond" },
        { fullName: "Simone Ferreira", title: "Sócia", company: "Ferreira & Cia Consultoria", industry: "consultoria", companySize: "1-10", location: "Porto Alegre, RS", linkedinUrl: "https://linkedin.com/in/stub-simone-ferreira" },
        { fullName: "Alexandre Costa", title: "Diretor de Operações", company: "Costa Limpeza Corporativa", industry: "servicos_recorrentes", companySize: "51-200", location: "Curitiba, PR", linkedinUrl: "https://linkedin.com/in/stub-alexandre-costa" },
        { fullName: "Natalia Barros", title: "CEO", company: "Barros Saúde Integral", industry: "clinica", companySize: "11-50", location: "Campinas, SP", linkedinUrl: "https://linkedin.com/in/stub-natalia-barros" },
        { fullName: "Rafael Gomes", title: "Sócio-Fundador", company: "Incorporadora Gomes SP", industry: "imobiliaria", companySize: "51-200", location: "São Paulo, SP", linkedinUrl: "https://linkedin.com/in/stub-rafael-gomes" },
        { fullName: "Isabela Teixeira", title: "Diretora", company: "Teixeira Gestão", industry: "consultoria", companySize: "1-10", location: "Rio de Janeiro, RJ", linkedinUrl: "https://linkedin.com/in/stub-isabela-teixeira" },
        { fullName: "Márcio Ribeiro", title: "CEO", company: "Ribeiro Segurança Patrimonial", industry: "servicos_recorrentes", companySize: "51-200", location: "Belo Horizonte, MG", linkedinUrl: "https://linkedin.com/in/stub-marcio-ribeiro" },
        { fullName: "Paula Santana", title: "Diretora Clínica", company: "Santana Nutrição e Saúde", industry: "clinica", companySize: "1-10", location: "Brasília, DF", linkedinUrl: "https://linkedin.com/in/stub-paula-santana" },
        { fullName: "Daniel Medeiros", title: "Sócio", company: "Medeiros Consultoria RH", industry: "consultoria", companySize: "11-50", location: "Florianópolis, SC", linkedinUrl: "https://linkedin.com/in/stub-daniel-medeiros" },
        { fullName: "Aline Freitas", title: "Diretora Comercial", company: "Freitas Imóveis Residenciais", industry: "imobiliaria", companySize: "11-50", location: "Recife, PE", linkedinUrl: "https://linkedin.com/in/stub-aline-freitas" },
    ];

// ─── 1. recommendProspects ────────────────────────────────────────────────────

export async function recommendProspects(
    orgId: string,
    limit = 25,
): Promise<{ prospectIds: string[]; created: number; skipped: number }> {
    const { prisma } = await import("@/lib/prisma");

    const batch = STUB_PROSPECTS.slice(0, limit);
    let created = 0;
    let skipped = 0;
    const prospectIds: string[] = [];

    for (const stub of batch) {
        try {
            const existing = await prisma.prospect.findFirst({
                where: { orgId, linkedinUrl: stub.linkedinUrl },
                select: { id: true },
            });

            if (existing) {
                prospectIds.push(existing.id);
                skipped++;
                continue;
            }

            const p = await prisma.prospect.create({
                data: { ...stub, orgId, source: "scrape_stub", status: "new" },
            });
            prospectIds.push(p.id);
            created++;
        } catch { skipped++; }
    }

    logger.info("[Outbound] recommendProspects", { orgId, created, skipped });
    return { prospectIds, created, skipped };
}

// ─── 2. startOutboundSequence ────────────────────────────────────────────────

export async function startOutboundSequence(
    orgId: string,
    prospectId: string,
): Promise<{ sequenceId: string; stage: string }> {
    const { prisma } = await import("@/lib/prisma");

    const prospect = await prisma.prospect.findFirst({
        where: { id: prospectId, orgId },
        select: { id: true },
    });
    if (!prospect) {
        throw new Error("PROSPECT_NOT_FOUND");
    }

    // Upsert (one active sequence per prospect)
    const existing = await prisma.outboundSequence.findUnique({
        where: { prospectId },
        select: { id: true, stage: true },
    });

    if (existing) {
        await prisma.outboundSequence.update({
            where: { id: existing.id },
            data: { paused: false, nextAt: new Date() },
        });
        return { sequenceId: existing.id, stage: existing.stage };
    }

    const seq = await prisma.outboundSequence.create({
        data: { orgId, prospectId, stage: "connect_note", nextAt: new Date(), paused: false },
    });

    logger.info("[Outbound] startOutboundSequence", { orgId, prospectId, sequenceId: seq.id });
    return { sequenceId: seq.id, stage: "connect_note" };
}

// ─── 3. buildMessage ─────────────────────────────────────────────────────────

export async function buildMessage(
    orgId: string,
    prospectId: string,
    stage: Stage,
): Promise<{ key: string; body: string }> {
    const { prisma } = await import("@/lib/prisma");

    const prospect = await prisma.prospect.findFirst({
        where: { id: prospectId, orgId },
        select: { fullName: true, company: true, title: true, industry: true },
    });
    if (!prospect) throw new Error(`Prospect not found: ${prospectId}`);

    // Load proof stat
    const proofStats = await prisma.proofStatSnapshot.findUnique({
        where: { orgId },
        select: { avgPaybackMonths: true, avgHoursSaved: true, avgMonthlyEconomy: true, totalCases: true },
    });

    let proofStat: string | undefined;
    if (proofStats?.avgPaybackMonths && proofStats.avgPaybackMonths > 0) {
        proofStat = `payback médio de ${proofStats.avgPaybackMonths} meses${proofStats.avgHoursSaved > 0 ? ` e ${Math.round(proofStats.avgHoursSaved)}h recuperadas por mês` : ""}`;
    }

    // For dm3: include deal one-pager link if available
    let dealLink: string | undefined;
    if (stage === "dm3") {
        const asmt = await prisma.assessment.findFirst({
            where: { organizationId: orgId, email: { contains: "@" } }, // latest assessment
            orderBy: { createdAt: "desc" },
            select: { id: true },
        });

        if (asmt) {
            const dp = await prisma.dealPacket.findFirst({
                where: { orgId, assessmentId: asmt.id },
                select: { execSlug: true },
                orderBy: { createdAt: "desc" },
            });
            if (dp) {
                const base = getBaseUrl();
                dealLink = `${base}/deal/${dp.execSlug}`;
            }
        }
    }

    const calLink = process.env.CALENDLY_URL;
    const icp = detectICP(prospect.industry, prospect.title);
    const firstName = prospect.fullName.split(" ")[0];

    const ctx: MessageContext = {
        firstName, company: prospect.company, title: prospect.title,
        proofStat, dealLink, calLink,
    };

    return renderTemplate(icp, stage, ctx);
}

// ─── 4. sendNextOutboundStep ─────────────────────────────────────────────────

export async function sendNextOutboundStep(
    orgId: string,
    sequenceId: string,
): Promise<{ sent: boolean; stage?: string; messageId?: string; reason?: string }> {
    const { prisma } = await import("@/lib/prisma");

    const seq = await prisma.outboundSequence.findFirst({
        where: { id: sequenceId, orgId },
        include: {
            prospect: {
                select: { id: true, status: true, orgId: true },
            },
        },
    });

    if (!seq) return { sent: false, reason: "sequence not found" };
    if (seq.paused) return { sent: false, reason: "paused" };
    if (seq.stage === "done") return { sent: false, reason: "sequence complete" };

    const now = new Date();
    if (new Date(seq.nextAt) > now) {
        return { sent: false, reason: `not due yet (nextAt=${seq.nextAt})` };
    }

    // Pause if prospect replied or booked meeting
    const stopStatuses = ["replied", "meeting", "lost", "do_not_contact"];
    if (stopStatuses.includes(seq.prospect.status)) {
        await prisma.outboundSequence.update({
            where: { id: sequenceId },
            data: { paused: true, lastResult: "replied" },
        });
        return { sent: false, reason: `prospect status=${seq.prospect.status} — paused` };
    }

    const stage = seq.stage as Stage;
    const { key, body } = await buildMessage(orgId, seq.prospectId, stage);

    // Create OutboundMessage (always stub)
    const msg = await prisma.outboundMessage.create({
        data: {
            orgId, prospectId: seq.prospectId, sequenceId,
            stage, channel: "linkedin", templateKey: key,
            body, status: "stub",
        },
    });

    // Advance stage
    const ns = nextStage(stage);
    const cooldownMs = STAGE_COOLDOWNS[stage] ?? 72 * 60 * 60 * 1000;
    const nextAt = new Date(now.getTime() + cooldownMs);

    await prisma.outboundSequence.update({
        where: { id: sequenceId },
        data: {
            stage: ns === "done" ? "done" : ns,
            nextAt,
            lastResult: "sent",
        },
    });

    logger.info("[Outbound] sendNextOutboundStep", {
        orgId, sequenceId, stage, nextStage: ns, messageId: msg.id,
    });

    return { sent: true, stage, messageId: msg.id };
}
