import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

import { buildAlertMessage } from "./response-builder";

const ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000;

const recentAlerts = new Map<string, number>();

async function getAlertPhones(): Promise<string[]> {
    return (process.env.WHATSAPP_COPILOT_PHONES || "")
        .split(",")
        .map((phone) => phone.trim())
        .filter(Boolean);
}

async function broadcast(phones: string[], message: string) {
    for (const phone of phones) {
        try {
            await sendWhatsAppMessage(phone, message);
        } catch (error: unknown) {
            logger.error("Alert broadcast failed", {
                phone,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}

function isCoolingDown(key: string): boolean {
    const lastSentAt = recentAlerts.get(key);
    if (!lastSentAt) {
        return false;
    }
    return Date.now() - lastSentAt < ALERT_COOLDOWN_MS;
}

function markSent(key: string) {
    recentAlerts.set(key, Date.now());
}

export async function alertHighProfitLeaks(orgId: string) {
    const cooldownKey = `profit_leak_${orgId}`;
    if (isCoolingDown(cooldownKey)) return;

    const leaks = await prisma.profitLeak.findMany({
        where: {
            orgId,
            status: "open",
            estimatedLossCents: { gte: 500000 },
        },
        orderBy: { estimatedLossCents: "desc" },
        take: 5,
        select: {
            title: true,
            estimatedLossCents: true,
        },
    });

    if (leaks.length === 0) return;

    const totalLoss = leaks.reduce((sum, leak) => sum + leak.estimatedLossCents, 0);
    const topLeak = leaks[0];

    const message = buildAlertMessage({
        emoji: "ALERT",
        title: "Dreno de Receita Detectado",
        body: [
            `*${leaks.length} vazamento${leaks.length > 1 ? "s" : ""} critico${leaks.length > 1 ? "s" : ""}* identificado${leaks.length > 1 ? "s" : ""}.`,
            "",
            "Valor total em risco:",
            `*R$ ${(totalLoss / 100).toLocaleString("pt-BR")}*`,
            "",
            `Principal: ${topLeak.title || "Vazamento sem titulo"}`,
        ].join("\n"),
        actions: ["/leaks", "/today", "/revenue"],
        footer: "InovaCortex Alert Engine",
    });

    const phones = await getAlertPhones();
    await broadcast(phones, message);
    markSent(cooldownKey);
    logger.info("Profit leak alert sent", { orgId, recipients: phones.length });
}

export async function alertProposalHotIntent(
    orgId: string,
    company: string,
    viewCount: number,
    proposalValueCents: number,
) {
    const cooldownKey = `proposal_intent_${orgId}_${company}`;
    if (isCoolingDown(cooldownKey)) return;

    const message = buildAlertMessage({
        emoji: "EYE",
        title: "Proposta com Alta Intencao",
        body: [
            `A proposta para *${company}* foi visualizada *${viewCount}x* nas ultimas horas.`,
            "",
            "Valor da proposta:",
            `*R$ ${(proposalValueCents / 100).toLocaleString("pt-BR")}*`,
            "",
            "Janela de follow-up quente. Aja agora.",
        ].join("\n"),
        actions: [`/client ${company}`, "/playbook", "/pipeline"],
        footer: "InovaCortex Alert Engine",
    });

    const phones = await getAlertPhones();
    await broadcast(phones, message);
    markSent(cooldownKey);
    logger.info("Proposal hot intent alert sent", { orgId, company, recipients: phones.length });
}

export async function alertStalledHotLeads(orgId: string) {
    const cooldownKey = `stalled_leads_${orgId}`;
    if (isCoolingDown(cooldownKey)) return;

    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const stalledLeads = await prisma.assessment.findMany({
        where: {
            organizationId: orgId,
            classification: { in: ["hot", "warm"] },
            status: { notIn: ["won", "lost", "archived"] },
            createdAt: { lte: cutoff },
        },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: {
            company: true,
            classification: true,
        },
    });

    if (stalledLeads.length === 0) return;

    const leadNames = stalledLeads
        .slice(0, 3)
        .map((lead) => `- *${lead.company}* (${lead.classification})`)
        .join("\n");

    const message = buildAlertMessage({
        emoji: "WARN",
        title: "Leads Quentes Travados",
        body: [
            `*${stalledLeads.length} lead${stalledLeads.length > 1 ? "s" : ""}* sem atividade por mais de 72h:`,
            "",
            leadNames,
        ].join("\n"),
        actions: ["/pipeline", "/today", "/playbook"],
        footer: "InovaCortex Alert Engine",
    });

    const phones = await getAlertPhones();
    await broadcast(phones, message);
    markSent(cooldownKey);
    logger.info("Stalled hot leads alert sent", { orgId, recipients: phones.length });
}

export async function alertRevenueAtRisk(orgId: string) {
    const cooldownKey = `revenue_risk_${orgId}`;
    if (isCoolingDown(cooldownKey)) return;

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const stalledProposals = await prisma.proposal.findMany({
        where: {
            assessment: { organizationId: orgId },
            status: "sent",
            updatedAt: { lte: cutoff },
        },
        orderBy: { updatedAt: "asc" },
        take: 10,
    });

    if (stalledProposals.length === 0) return;

    const phones = await getAlertPhones();
    if (phones.length === 0) return;

    const message = buildAlertMessage({
        emoji: "DOWN",
        title: "Receita em Risco",
        body: [
            `*${stalledProposals.length} proposta${stalledProposals.length > 1 ? "s" : ""}* sem resposta ha mais de 7 dias.`,
            "",
            "Valor potencial parado:",
            `*${stalledProposals.length} negociacao${stalledProposals.length > 1 ? "es" : ""}* aguardando acao.`,
            "",
            "Cada dia sem follow-up reduz a chance de fechamento.",
        ].join("\n"),
        actions: ["/pipeline", "/today", "/playbook"],
        footer: "InovaCortex Alert Engine",
    });

    await broadcast(phones, message);
    markSent(cooldownKey);
    logger.info("Revenue at risk alert sent", { orgId, recipients: phones.length });
}

export async function runAlertEngine(orgId: string) {
    logger.info("Alert engine scan started", { orgId });
    await Promise.allSettled([
        alertHighProfitLeaks(orgId),
        alertStalledHotLeads(orgId),
        alertRevenueAtRisk(orgId),
    ]);
}
