import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { buildAlertMessage } from "./response-builder";

/**
 * WhatsApp Alert Engine (V34)
 *
 * Proactively pushes intelligence alerts to authorized admin/CEO phones.
 * Triggered on-demand or via cron. Each alert has a cooldown to avoid spam.
 *
 * Alert Types:
 *   1. High-value ProfitLeak detected
 *   2. Proposal viewed multiple times (hot intent)
 *   3. Hot lead stalled (no activity)
 *   4. Revenue at risk (stalled proposals)
 */

const ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4h between same alert type per org

// ─── Phone Resolution ─────────────────────────────────────────────────────────

async function getAlertPhones(): Promise<string[]> {
    return (process.env.WHATSAPP_COPILOT_PHONES || "")
        .split(",")
        .map(p => p.trim())
        .filter(Boolean);
}

async function broadcast(phones: string[], message: string) {
    for (const phone of phones) {
        try {
            await sendWhatsAppMessage(phone, message);
        } catch (err: any) {
            logger.error(`Alert broadcast failed to ${phone}: ${err.message}`);
        }
    }
}

// ─── Cooldown Guard ───────────────────────────────────────────────────────────

// In-memory cooldown (per process). For multi-instance, use Redis or DB flag.
const recentAlerts = new Map<string, number>();

function isCoolingDown(key: string): boolean {
    const last = recentAlerts.get(key);
    if (!last) return false;
    return Date.now() - last < ALERT_COOLDOWN_MS;
}

function markSent(key: string) {
    recentAlerts.set(key, Date.now());
}

// ─── Alert 1: High-Value ProfitLeak ──────────────────────────────────────────

export async function alertHighProfitLeaks(orgId: string) {
    const cooldownKey = `profit_leak_${orgId}`;
    if (isCoolingDown(cooldownKey)) return;

    const leaks = await (prisma as any).profitLeak.findMany({
        where: { orgId, status: "open", estimatedLossCents: { gte: 500000 } }, // ≥ R$5k
        orderBy: { estimatedLossCents: "desc" },
        take: 5
    });

    if (leaks.length === 0) return;

    const totalLoss = leaks.reduce((sum: number, l: any) => sum + l.estimatedLossCents, 0);
    const topLeak = leaks[0];

    const message = buildAlertMessage({
        emoji: "🚨",
        title: "Dreno de Receita Detectado",
        body: [
            `*${leaks.length} vazamento${leaks.length > 1 ? "s" : ""} crítico${leaks.length > 1 ? "s" : ""}* identificado${leaks.length > 1 ? "s" : ""}.`,
            ``,
            `Valor total em risco:`,
            `*R$ ${(totalLoss / 100).toLocaleString("pt-BR")}*`,
            ``,
            `Principal: ${topLeak.title || "Vazamento sem título"}`
        ].join("\n"),
        actions: ["/leaks", "/today", "/revenue"],
        footer: "InovaCortex Alert Engine"
    });

    const phones = await getAlertPhones();
    await broadcast(phones, message);
    markSent(cooldownKey);
    logger.info(`Alert: profit leaks sent to ${phones.length} phones (org: ${orgId})`);
}

// ─── Alert 2: Proposal Viewed Multiple Times ──────────────────────────────────

export async function alertProposalHotIntent(orgId: string, company: string, viewCount: number, proposalValueCents: number) {
    const cooldownKey = `proposal_intent_${orgId}_${company}`;
    if (isCoolingDown(cooldownKey)) return;

    const message = buildAlertMessage({
        emoji: "👁️",
        title: "Proposta com Alta Intenção",
        body: [
            `A proposta para *${company}* foi visualizada *${viewCount}x* nas últimas horas.`,
            ``,
            `Valor da proposta:`,
            `*R$ ${(proposalValueCents / 100).toLocaleString("pt-BR")}*`,
            ``,
            `Janela de follow-up quente — aja agora!`
        ].join("\n"),
        actions: [`/client ${company}`, "/playbook", "/pipeline"],
        footer: "InovaCortex Alert Engine"
    });

    const phones = await getAlertPhones();
    await broadcast(phones, message);
    markSent(cooldownKey);
    logger.info(`Alert: hot proposal intent (${company}) sent`);
}

// ─── Alert 3: Hot Lead Stalled ────────────────────────────────────────────────

export async function alertStalledHotLeads(orgId: string) {
    const cooldownKey = `stalled_leads_${orgId}`;
    if (isCoolingDown(cooldownKey)) return;

    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72h stall

    const stalledLeads = await (prisma as any).assessment.findMany({
        where: {
            organizationId: orgId,
            classification: { in: ["hot", "warm"] },
            status: { notIn: ["won", "lost", "archived"] },
            updatedAt: { lte: cutoff }
        },
        orderBy: { updatedAt: "asc" },
        take: 5
    });

    if (stalledLeads.length === 0) return;

    const leadNames = stalledLeads.slice(0, 3)
        .map((l: any) => `• *${l.company}* (${l.classification})`)
        .join("\n");

    const message = buildAlertMessage({
        emoji: "⚠️",
        title: "Leads Quentes Travados",
        body: [
            `*${stalledLeads.length} lead${stalledLeads.length > 1 ? "s" : ""}* sem atividade por mais de 72h:`,
            ``,
            leadNames
        ].join("\n"),
        actions: ["/pipeline", "/today", "/playbook"],
        footer: "InovaCortex Alert Engine"
    });

    const phones = await getAlertPhones();
    await broadcast(phones, message);
    markSent(cooldownKey);
    logger.info(`Alert: ${stalledLeads.length} stalled hot leads (org: ${orgId})`);
}

// ─── Alert 4: Revenue at Risk (stalled proposals) ─────────────────────────────

export async function alertRevenueAtRisk(orgId: string) {
    const cooldownKey = `revenue_risk_${orgId}`;
    if (isCoolingDown(cooldownKey)) return;

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

    const stalledProposals = await prisma.proposal.findMany({
        where: {
            assessment: { organizationId: orgId },
            status: "sent",
            updatedAt: { lte: cutoff }
        },
        orderBy: { updatedAt: "asc" },
        take: 10
    });

    if (stalledProposals.length === 0) return;

    const phones = await getAlertPhones();
    if (phones.length === 0) return;

    const message = buildAlertMessage({
        emoji: "📉",
        title: "Receita em Risco",
        body: [
            `*${stalledProposals.length} proposta${stalledProposals.length > 1 ? "s" : ""}* sem resposta há mais de 7 dias.`,
            ``,
            `Valor potencial parado:`,
            `*${stalledProposals.length} negociações* aguardando ação.`,
            ``,
            `Cada dia sem follow-up reduz a chance de fechamento em ~10%.`
        ].join("\n"),
        actions: ["/pipeline", "/today", "/playbook"],
        footer: "InovaCortex Alert Engine"
    });

    await broadcast(phones, message);
    markSent(cooldownKey);
    logger.info(`Alert: ${stalledProposals.length} proposals at risk (org: ${orgId})`);
}

// ─── Run All Alerts ───────────────────────────────────────────────────────────

/**
 * Scan and send all applicable alerts for an org.
 * Safe to call frequently — cooldowns prevent spam.
 */
export async function runAlertEngine(orgId: string) {
    logger.info(`Alert Engine: scanning org ${orgId}`);

    await Promise.allSettled([
        alertHighProfitLeaks(orgId),
        alertStalledHotLeads(orgId),
        alertRevenueAtRisk(orgId)
    ]);
}
