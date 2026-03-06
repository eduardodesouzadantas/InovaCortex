import { buildAlertMessage } from "./response-builder";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { logger } from "@/lib/logger";
import type { SystemEventType } from "@/lib/system-events";

/**
 * lib/whatsapp/event-dispatcher.ts — V34
 *
 * Maps SystemEvent types to WhatsApp push notifications.
 * Called fire-and-forget from logSystemEvent().
 *
 * Dispatches:
 *   proposalViewed        → Hot intent alert
 *   profitLeakDetected    → Revenue drain alert
 *   paymentConfirmed      → Success celebration
 *   meetingMissed         → No-show alert
 *   growthSignalDetected  → Opportunity alert
 */

// ─── Phone Resolution ─────────────────────────────────────────────────────────

async function getAlertPhones(): Promise<string[]> {
    return (process.env.WHATSAPP_COPILOT_PHONES || "")
        .split(",")
        .map(p => p.trim())
        .filter(Boolean);
}

async function broadcast(phones: string[], message: string) {
    for (const phone of phones) {
        await sendWhatsAppMessage(phone, message).catch(err =>
            logger.error(`EventDispatcher: failed to send to ${phone}: ${err.message}`)
        );
    }
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

async function onProposalViewed(orgId: string, payload: any) {
    const company = payload.company || payload.clientName || "Cliente";
    const viewCount = payload.viewCount || payload.views || 1;
    const valueR = payload.valueCents ? `R$ ${(payload.valueCents / 100).toLocaleString("pt-BR")}` : null;

    const message = buildAlertMessage({
        emoji: "👁️",
        title: "Proposta Visualizada",
        body: [
            `*${company}* abriu a proposta *${viewCount === 1 ? "agora" : `${viewCount}x`}*.`,
            ...(valueR ? [`\nValor em jogo: *${valueR}*`] : []),
            `\n🔥 Janela de follow-up quente — aja agora!`
        ].join("\n"),
        actions: [`/client ${company}`, "/playbook"],
        footer: "InovaCortex"
    });

    await broadcast(await getAlertPhones(), message);
}

async function onProfitLeakDetected(orgId: string, payload: any) {
    const title = payload.title || "Vazamento detectado";
    const lossR = payload.estimatedLossCents
        ? `R$ ${(payload.estimatedLossCents / 100).toLocaleString("pt-BR")}`
        : "valor a apurar";

    const message = buildAlertMessage({
        emoji: "🚨",
        title: "Dreno de Receita",
        body: `*${title}*\n\nImpacto estimado: *${lossR}* por mês.`,
        actions: ["/leaks", "/today"],
        footer: "InovaCortex"
    });

    await broadcast(await getAlertPhones(), message);
}

async function onPaymentConfirmed(orgId: string, payload: any) {
    const company = payload.company || payload.clientName || "Cliente";
    const amountR = payload.amountCents
        ? `R$ ${(payload.amountCents / 100).toLocaleString("pt-BR")}`
        : "valor confirmado";

    const message = buildAlertMessage({
        emoji: "💰",
        title: "Pagamento Confirmado!",
        body: `*${company}* confirmou pagamento de *${amountR}*.\n\n🎯 Receita recorrente garantida.`,
        actions: ["/revenue", "/pipeline"],
        footer: "InovaCortex"
    });

    await broadcast(await getAlertPhones(), message);
}

async function onMeetingMissed(orgId: string, payload: any) {
    const company = payload.company || payload.leadName || "Lead";
    const scheduled = payload.scheduledAt
        ? new Date(payload.scheduledAt).toLocaleString("pt-BR")
        : "horário não registrado";

    const message = buildAlertMessage({
        emoji: "⏰",
        title: "No-Show Detectado",
        body: [
            `*${company}* não compareceu à reunião.`,
            `\nHorário: ${scheduled}`,
            `\nReagende enquanto ainda está fresco.`
        ].join("\n"),
        actions: [`/client ${company}`, "/today", "/pipeline"],
        footer: "InovaCortex"
    });

    await broadcast(await getAlertPhones(), message);
}

async function onGrowthSignalDetected(orgId: string, payload: any) {
    const signal = payload.signal || payload.type || "Sinal de crescimento";
    const source = payload.source || payload.channel || "canal não identificado";
    const lead = payload.leadName || payload.company || null;

    const message = buildAlertMessage({
        emoji: "📈",
        title: "Sinal de Crescimento",
        body: [
            `*${signal}* detectado via *${source}*.`,
            ...(lead ? [`\nLead: *${lead}*`] : []),
            `\nMomento ideal para ação outbound!`
        ].join("\n"),
        actions: ["/pipeline", "/today"],
        footer: "InovaCortex"
    });

    await broadcast(await getAlertPhones(), message);
}

// ─── Main Dispatcher ──────────────────────────────────────────────────────────

const DISPATCHED_EVENTS: Partial<Record<SystemEventType, true>> = {
    proposal_viewed: true,
    profit_leak_detected: true,
    payment_received: true,
};

/**
 * Dispatch a WhatsApp notification for a SystemEvent.
 * Called fire-and-forget — never throws.
 */
export async function dispatchEventNotification(
    type: string,
    orgId: string,
    payload: any
) {
    try {
        switch (type) {
            case "proposal_viewed":
                await onProposalViewed(orgId, payload);
                break;
            case "profit_leak_detected":
                await onProfitLeakDetected(orgId, payload);
                break;
            case "payment_received":
                await onPaymentConfirmed(orgId, payload);
                break;
            case "meeting_missed":
                await onMeetingMissed(orgId, payload);
                break;
            case "growth_signal_detected":
                await onGrowthSignalDetected(orgId, payload);
                break;
            case "rep_performance_alert":
                await onRepPerformanceAlert(orgId, payload);
                break;
            case "sla_breach":
                await onSlaBreach(orgId, payload);
                break;
            case "leak_owner_alert":
                await onLeakOwnerAlert(orgId, payload);
                break;
            case "client_disabled":
                await onClientDisabled(orgId, payload);
                break;
            default:
                // No notification for this event type
                break;
        }
    } catch (err: any) {
        logger.error(`EventDispatcher: ${type} handler failed: ${err.message}`);
    }
}

async function onRepPerformanceAlert(orgId: string, payload: any) {
    const message = buildAlertMessage({
        emoji: "📉",
        title: "Alerta de Performance",
        body: `*${payload.name}* está operando abaixo da meta.\n\nScore: *${payload.score}*\nTempo Médio: *${payload.replyTime}m*\nMotivo: ${payload.reason}`,
        actions: ["/leaderboard", `/rep ${payload.name}`],
        footer: "Performance OS"
    });
    await broadcast(await getAlertPhones(), message);
}

async function onSlaBreach(orgId: string, payload: any) {
    const message = buildAlertMessage({
        emoji: "⏰",
        title: "Quebra de SLA",
        body: `Conversa pendente com *${payload.assignedTo}*.\n\nVencimento: ${new Date(payload.slaDueAt).toLocaleString("pt-BR")}\nÚltima: "${payload.preview}"`,
        actions: ["/sla", "/today"],
        footer: "SLA Engine"
    });
    await broadcast(await getAlertPhones(), message);
}

async function onLeakOwnerAlert(orgId: string, payload: any) {
    const message = buildAlertMessage({
        emoji: "💸",
        title: "Responsabilidade de Vazamento",
        body: `*${payload.ownerName}* é responsável por um vazamento crítico.\n\nItem: ${payload.title}\nImpacto: *R$ ${(payload.impact / 100).toLocaleString("pt-BR")}*`,
        actions: ["/leaks", `/rep ${payload.ownerName}`],
        footer: "Leak Engine"
    });
    await broadcast(await getAlertPhones(), message);
}

async function onClientDisabled(orgId: string, payload: any) {
    const message = buildAlertMessage({
        emoji: "🚫",
        title: "Cliente Desativado",
        body: `Acesso ao workspace *${payload.entityId}* foi revogado e os tokens rotacionados.`,
        actions: ["/command", "/today"],
        footer: "Admin Controls"
    });
    await broadcast(await getAlertPhones(), message);
}
