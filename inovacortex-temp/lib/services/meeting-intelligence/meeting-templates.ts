/**
 * lib/services/meeting-intelligence/meeting-templates.ts
 * V16.3: WhatsApp message copy for meeting lifecycle events.
 *
 * Rules:
 * - Short, consultive, no buzzwords
 * - Always include: date/time (pt-BR) + meet link + reschedule/cancel
 * - If diagnostico/proposta exist: include link (optional)
 * - Include opt-out instruction
 */

export interface MeetingTemplateInput {
    leadName?: string;
    leadPhone: string;
    startAt: Date;
    timezone?: string;
    meetingUrl?: string;
    rescheduleUrl?: string;
    diagnosticoUrl?: string;
    propostaUrl?: string;
}

function formatDateTime(date: Date, timezone = "America/Sao_Paulo"): string {
    return date.toLocaleString("pt-BR", {
        timeZone: timezone,
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function greeting(name?: string) {
    return name ? `Olá, ${name.split(" ")[0]}!` : "Olá!";
}

function footer(rescheduleUrl?: string): string {
    const lines = ["Para cancelar, responda SAIR."];
    if (rescheduleUrl) lines.unshift(`Precisa reagendar? ${rescheduleUrl}`);
    return lines.join("\n");
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function buildConfirmationMessage(m: MeetingTemplateInput): string {
    const dt = formatDateTime(m.startAt, m.timezone);
    const lines = [
        `${greeting(m.leadName)} ✅ Sua reunião foi confirmada.`,
        ``,
        `📅 ${dt}`,
        m.meetingUrl ? `🔗 Acesse: ${m.meetingUrl}` : null,
        m.diagnosticoUrl ? `📋 Seu diagnóstico: ${m.diagnosticoUrl}` : null,
        ``,
        footer(m.rescheduleUrl),
    ];
    return lines.filter(l => l !== null).join("\n");
}

export function buildReminder24h(m: MeetingTemplateInput): string {
    const dt = formatDateTime(m.startAt, m.timezone);
    const lines = [
        `${greeting(m.leadName)} Lembrete: sua reunião é amanhã.`,
        ``,
        `📅 ${dt}`,
        m.meetingUrl ? `🔗 Link: ${m.meetingUrl}` : null,
        ``,
        footer(m.rescheduleUrl),
    ];
    return lines.filter(l => l !== null).join("\n");
}

export function buildReminder1h(m: MeetingTemplateInput): string {
    const dt = formatDateTime(m.startAt, m.timezone);
    const lines = [
        `${greeting(m.leadName)} Em 1 hora começa nossa conversa.`,
        ``,
        `📅 ${dt}`,
        m.meetingUrl ? `🔗 ${m.meetingUrl}` : null,
        ``,
        footer(m.rescheduleUrl),
    ];
    return lines.filter(l => l !== null).join("\n");
}

export function buildFollowup2h(m: MeetingTemplateInput): string {
    const lines = [
        `${greeting(m.leadName)} Obrigado pela conversa! 🙏`,
        ``,
        `Se tiver alguma dúvida ou quiser avançar, é só responder aqui.`,
        m.propostaUrl ? `📄 Sua proposta: ${m.propostaUrl}` : null,
        ``,
        "Para não receber mais mensagens, responda SAIR.",
    ];
    return lines.filter(l => l !== null).join("\n");
}

export function buildFollowup48h(m: MeetingTemplateInput): string {
    const lines = [
        `${greeting(m.leadName)} Passaram dois dias desde nossa reunião.`,
        ``,
        `Ficou com alguma dúvida? Posso ajudar a dar o próximo passo.`,
        m.propostaUrl ? `📄 Proposta: ${m.propostaUrl}` : null,
        ``,
        "Para não receber mais mensagens, responda SAIR.",
    ];
    return lines.filter(l => l !== null).join("\n");
}

export type TemplateKey =
    | "meeting_confirmation"
    | "meeting_reminder_24h"
    | "meeting_reminder_1h"
    | "meeting_followup_2h"
    | "meeting_followup_48h";

export function buildMessageByKey(key: TemplateKey, input: MeetingTemplateInput): string {
    switch (key) {
        case "meeting_confirmation": return buildConfirmationMessage(input);
        case "meeting_reminder_24h": return buildReminder24h(input);
        case "meeting_reminder_1h": return buildReminder1h(input);
        case "meeting_followup_2h": return buildFollowup2h(input);
        case "meeting_followup_48h": return buildFollowup48h(input);
        default: return `Olá! Lembrete sobre sua reunião.`;
    }
}
