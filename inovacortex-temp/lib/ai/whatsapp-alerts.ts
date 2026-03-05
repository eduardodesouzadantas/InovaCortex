import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { logger } from "@/lib/logger";

/**
 * WhatsApp Alert Broadcaster (V34)
 * Sends proactive intelligence alerts to authorized admin phones.
 *
 * Env:
 *   WHATSAPP_COPILOT_PHONES   = comma-separated E.164 phones to notify
 *   WHATSAPP_COPILOT_ORG_SLUG = org slug for context
 */

async function getAdminPhones(): Promise<string[]> {
    const phones = process.env.WHATSAPP_COPILOT_PHONES?.split(",").map(p => p.trim()) || [];
    return phones.filter(Boolean);
}

/**
 * Send a critical alert to all authorized admins.
 */
export async function broadcastAlert(orgId: string, alert: {
    emoji: string;
    title: string;
    body: string;
    actions?: string[];
}) {
    const phones = await getAdminPhones();
    if (phones.length === 0) {
        logger.warn("broadcastAlert: no phones configured (WHATSAPP_COPILOT_PHONES)");
        return;
    }

    const message = [
        `${alert.emoji} *${alert.title}*`,
        "",
        alert.body,
        ...(alert.actions?.length ? ["", "⚡ Ações:", ...alert.actions.map(a => `→ ${a}`)] : []),
        "",
        "_InovaCortex AI Control Room_"
    ].join("\n").slice(0, 4000);

    for (const phone of phones) {
        await sendWhatsAppMessage(phone, message);
    }

    logger.info(`Alert broadcasted to ${phones.length} admin(s): ${alert.title}`);
}

// ─── Pre-built Alert Templates ────────────────────────────────────────────────

export async function alertNewHotLead(orgId: string, leadName: string, company: string, score: number) {
    await broadcastAlert(orgId, {
        emoji: "🔥",
        title: "Lead Quente Detectado",
        body: `*${leadName}* da empresa *${company}* chegou com score *${score}*. Pipeline prioritário!`,
        actions: ["/client " + company, "/pipeline", "/today"]
    });
}

export async function alertProposalViewed(orgId: string, company: string, proposalId: string) {
    await broadcastAlert(orgId, {
        emoji: "👁️",
        title: "Proposta Visualizada",
        body: `A proposta para *${company}* foi aberta agora. Janela de follow-up ativa!`,
        actions: [`/client ${company}`, "/playbook"]
    });
}

export async function alertRevenueDrop(orgId: string, delta: number) {
    await broadcastAlert(orgId, {
        emoji: "📉",
        title: "Queda de Receita Detectada",
        body: `Revenue esperado caiu *R$ ${Math.abs(delta / 100).toLocaleString("pt-BR")}* nas últimas 24h.`,
        actions: ["/leaks", "/revenue", "/today"]
    });
}

export async function alertDailySummary(orgId: string) {
    // Lazy import engines to avoid circular deps
    const { scanRevenueLeaks } = await import("@/lib/analytics/leak-detector");
    const { generateDailyActions } = await import("@/lib/analytics/action-engine");

    const [leaks, actions] = await Promise.all([
        scanRevenueLeaks(orgId),
        generateDailyActions(orgId)
    ]);

    const topActions = actions.actions?.slice(0, 3).map((a: any) => a.title || a) || [];
    const leakValue = leaks.totalLeakValue ? `R$ ${(leaks.totalLeakValue / 100).toLocaleString("pt-BR")}` : "—";

    await broadcastAlert(orgId, {
        emoji: "🌅",
        title: "Briefing Diário — InovaCortex",
        body: `Bom dia! Aqui está seu resumo estratégico.\n\nVazamentos detectados: *${leakValue}*\nAções prioritárias: *${topActions.length}*`,
        actions: topActions.length > 0 ? [topActions[0], "/today", "/leaks"] : ["/today", "/revenue"]
    });
}
