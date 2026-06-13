import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { logger } from "@/lib/logger";
import { buildAlertMessage } from "./response-builder";

type EventPayload = Record<string, unknown>;

function getString(payload: EventPayload, key: string): string | null {
    const value = payload[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getNumber(payload: EventPayload, key: string): number | null {
    const value = payload[key];
    return typeof value === "number" ? value : null;
}

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
            logger.error("EventDispatcher send failed", {
                phone,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}

async function onProposalViewed(_orgId: string, payload: EventPayload) {
    const company = getString(payload, "company") ?? getString(payload, "clientName") ?? "Cliente";
    const viewCount = getNumber(payload, "viewCount") ?? getNumber(payload, "views") ?? 1;
    const valueCents = getNumber(payload, "valueCents");
    const valueLabel = valueCents ? `R$ ${(valueCents / 100).toLocaleString("pt-BR")}` : null;

    await broadcast(await getAlertPhones(), buildAlertMessage({
        emoji: "Olho",
        title: "Proposta Visualizada",
        body: [
            `*${company}* abriu a proposta *${viewCount === 1 ? "agora" : `${viewCount}x`}*.`,
            ...(valueLabel ? [`\nValor em jogo: *${valueLabel}*`] : []),
            "\nJanela de follow-up quente - aja agora.",
        ].join("\n"),
        actions: [`/client ${company}`, "/playbook"],
        footer: "InovaCortex",
    }));
}

async function onProfitLeakDetected(_orgId: string, payload: EventPayload) {
    const title = getString(payload, "title") ?? "Vazamento detectado";
    const estimatedLossCents = getNumber(payload, "estimatedLossCents");
    const lossLabel = estimatedLossCents ? `R$ ${(estimatedLossCents / 100).toLocaleString("pt-BR")}` : "valor a apurar";

    await broadcast(await getAlertPhones(), buildAlertMessage({
        emoji: "Alerta",
        title: "Dreno de Receita",
        body: `*${title}*\n\nImpacto estimado: *${lossLabel}* por mes.`,
        actions: ["/leaks", "/today"],
        footer: "InovaCortex",
    }));
}

async function onPaymentConfirmed(_orgId: string, payload: EventPayload) {
    const company = getString(payload, "company") ?? getString(payload, "clientName") ?? "Cliente";
    const amountCents = getNumber(payload, "amountCents");
    const amountLabel = amountCents ? `R$ ${(amountCents / 100).toLocaleString("pt-BR")}` : "valor confirmado";

    await broadcast(await getAlertPhones(), buildAlertMessage({
        emoji: "Receita",
        title: "Pagamento Confirmado",
        body: `*${company}* confirmou pagamento de *${amountLabel}*.\n\nReceita recorrente garantida.`,
        actions: ["/revenue", "/pipeline"],
        footer: "InovaCortex",
    }));
}

async function onMeetingMissed(_orgId: string, payload: EventPayload) {
    const company = getString(payload, "company") ?? getString(payload, "leadName") ?? "Lead";
    const scheduledAt = getString(payload, "scheduledAt");
    const scheduled = scheduledAt ? new Date(scheduledAt).toLocaleString("pt-BR") : "horario nao registrado";

    await broadcast(await getAlertPhones(), buildAlertMessage({
        emoji: "Agenda",
        title: "No-Show Detectado",
        body: [`*${company}* nao compareceu a reuniao.`, `\nHorario: ${scheduled}`, "\nReagende enquanto ainda esta fresco."].join("\n"),
        actions: [`/client ${company}`, "/today", "/pipeline"],
        footer: "InovaCortex",
    }));
}

async function onGrowthSignalDetected(_orgId: string, payload: EventPayload) {
    const signal = getString(payload, "signal") ?? getString(payload, "type") ?? "Sinal de crescimento";
    const source = getString(payload, "source") ?? getString(payload, "channel") ?? "canal nao identificado";
    const lead = getString(payload, "leadName") ?? getString(payload, "company");

    await broadcast(await getAlertPhones(), buildAlertMessage({
        emoji: "Growth",
        title: "Sinal de Crescimento",
        body: [`*${signal}* detectado via *${source}*.`, ...(lead ? [`\nLead: *${lead}*`] : []), "\nMomento ideal para acao outbound."].join("\n"),
        actions: ["/pipeline", "/today"],
        footer: "InovaCortex",
    }));
}

async function onRepPerformanceAlert(_orgId: string, payload: EventPayload) {
    const name = getString(payload, "name") ?? "Rep";
    const score = getNumber(payload, "score") ?? 0;
    const replyTime = getNumber(payload, "replyTime") ?? 0;
    const reason = getString(payload, "reason") ?? "Sem motivo informado";

    await broadcast(await getAlertPhones(), buildAlertMessage({
        emoji: "Performance",
        title: "Alerta de Performance",
        body: `*${name}* esta operando abaixo da meta.\n\nScore: *${score}*\nTempo Medio: *${replyTime}m*\nMotivo: ${reason}`,
        actions: ["/leaderboard", `/rep ${name}`],
        footer: "Performance OS",
    }));
}

async function onSlaBreach(_orgId: string, payload: EventPayload) {
    const assignedTo = getString(payload, "assignedTo") ?? "Responsavel";
    const slaDueAt = getString(payload, "slaDueAt");
    const preview = getString(payload, "preview") ?? "Sem preview";

    await broadcast(await getAlertPhones(), buildAlertMessage({
        emoji: "SLA",
        title: "Quebra de SLA",
        body: `Conversa pendente com *${assignedTo}*.\n\nVencimento: ${slaDueAt ? new Date(slaDueAt).toLocaleString("pt-BR") : "nao informado"}\nUltima: "${preview}"`,
        actions: ["/sla", "/today"],
        footer: "SLA Engine",
    }));
}

async function onLeakOwnerAlert(_orgId: string, payload: EventPayload) {
    const ownerName = getString(payload, "ownerName") ?? "Responsavel";
    const title = getString(payload, "title") ?? "Vazamento";
    const impact = getNumber(payload, "impact") ?? 0;

    await broadcast(await getAlertPhones(), buildAlertMessage({
        emoji: "Leak",
        title: "Responsabilidade de Vazamento",
        body: `*${ownerName}* e responsavel por um vazamento critico.\n\nItem: ${title}\nImpacto: *R$ ${(impact / 100).toLocaleString("pt-BR")}*`,
        actions: ["/leaks", `/rep ${ownerName}`],
        footer: "Leak Engine",
    }));
}

async function onClientDisabled(_orgId: string, payload: EventPayload) {
    const entityId = getString(payload, "entityId") ?? "workspace";

    await broadcast(await getAlertPhones(), buildAlertMessage({
        emoji: "Cliente",
        title: "Cliente Desativado",
        body: `Acesso ao workspace *${entityId}* foi revogado e os tokens rotacionados.`,
        actions: ["/command", "/today"],
        footer: "Admin Controls",
    }));
}

export async function dispatchEventNotification(
    type: string,
    orgId: string,
    payload: EventPayload,
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
                break;
        }
    } catch (error: unknown) {
        logger.error("EventDispatcher handler failed", {
            type,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
