/**
 * lib/dealflow/followup-rules.ts
 * V21: Deterministic follow-up rules engine (zero LLM, zero tokens).
 *
 * Rules (evaluated on each ActionQueue run or signal trigger):
 *   viewed + no meeting in 24h   → consultive followup
 *   no_response_72h              → final followup
 *   meeting_booked               → pause sequence + send briefing to owner
 *
 * Messages are deterministic templates based on assessment context.
 */

import { logger } from "@/lib/logger";

export type FollowUpAction =
    | "send_consultive_followup"
    | "send_final_followup"
    | "pause_sequence_send_briefing"
    | "none";

export interface FollowUpDecision {
    action: FollowUpAction;
    reason: string;
    scheduleDelayMs?: number;   // how long to wait before executing
    messageTemplate?: string;
}

interface SignalSummary {
    hasViewed: boolean;
    hasMeetingBooked: boolean;
    hasNoResponse72h: boolean;
    hasWhatsappReplied: boolean;
    lastSignalAt: Date | null;
    hoursSinceViewed: number | null;
}

// ─── Evaluate Follow-Up Decision ─────────────────────────────────────────────

export function evaluateFollowUp(signals: SignalSummary): FollowUpDecision {
    // Priority 1: Meeting booked → pause, send briefing
    if (signals.hasMeetingBooked) {
        return {
            action: "pause_sequence_send_briefing",
            reason: "Reunião agendada — pausar sequência",
        };
    }

    // Priority 2: No response 72h → final message
    if (signals.hasNoResponse72h) {
        return {
            action: "send_final_followup",
            reason: "Sem resposta em 72h — mensagem final",
        };
    }

    // Priority 3: Viewed but no meeting in 24h → consultive followup
    if (signals.hasViewed && !signals.hasMeetingBooked) {
        const hoursSince = signals.hoursSinceViewed ?? 0;
        if (hoursSince >= 24) {
            return {
                action: "send_consultive_followup",
                reason: `Visualizou há ${Math.round(hoursSince)}h sem agendar`,
                scheduleDelayMs: 0, // run immediately
            };
        } else {
            // Schedule for 24h post-view
            const remainingMs = (24 - hoursSince) * 60 * 60 * 1000;
            return {
                action: "none",
                reason: `Ainda dentro das 24h — reagendar em ${Math.round(remainingMs / 3_600_000)}h`,
                scheduleDelayMs: remainingMs,
            };
        }
    }

    return { action: "none", reason: "Sem sinais suficientes" };
}

// ─── Message Templates ────────────────────────────────────────────────────────

export function buildConsultiveFollowup(companyName: string, execSlug: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://inovacortex.com.br";
    return `Olá! Passando para dar um oi — vi que você teve a chance de conferir a análise que preparei para ${companyName}.

Queria entender: teve alguma dúvida sobre o que foi apresentado? Às vezes a parte de ROI levanta perguntas sobre como chegamos nesses números.

Fico aqui se quiser conversar: ${baseUrl}/deal/${execSlug}

Um abraço,
Equipe InovaCortex`;
}

export function buildFinalFollowup(companyName: string): string {
    return `Olá! Esta é minha última mensagem por aqui.

Entendo completamente que às vezes o momento não é o ideal, e tudo bem. Quando fizer sentido para ${companyName}, pode me chamar.

Se quiser, é só responder essa mensagem que continuamos de onde paramos. 🤝

Até mais,
Equipe InovaCortex`;
}

export function buildBriefingToOwner(
    companyName: string, segment: string, tierLabel: string,
    execSlug: string, roiSnapshot?: string,
): string {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://inovacortex.com.br";
    let roiLines = "";
    if (roiSnapshot) {
        try {
            const r = JSON.parse(roiSnapshot);
            roiLines = `\n\nROI Projetado:\n• Economia: R$ ${Math.round(r.operationalSavingsEstimate ?? 0).toLocaleString("pt-BR")}/mês\n• Payback: ${r.estimatedPaybackMonths ?? "?"} meses`;
        } catch { /* ok */ }
    }
    return `📋 BRIEFING DE REUNIÃO — ${tierLabel.toUpperCase()}

Cliente: ${companyName}
Segmento: ${segment}
${roiLines}

Executive One-Pager que o cliente recebeu:
${baseUrl}/deal/${execSlug}

✅ Próximo passo: reunião agendada.
Prepare: validação do escopo com assessment, timeline e condições comerciais.`;
}

// ─── Process Follow-Up for DealPacket ────────────────────────────────────────

export async function processFollowUp(dealPacketId: string): Promise<void> {
    const { prisma } = await import("@/lib/prisma");

    const packet = await (prisma as any).dealPacket.findUnique({
        where: { id: dealPacketId },
        include: { signals: { orderBy: { createdAt: "asc" } } },
    }).catch(() => null);

    if (!packet) { logger.warn("[FollowUp] DealPacket not found", { dealPacketId }); return; }

    const signals = packet.signals ?? [];
    const now = Date.now();

    const hasViewed = signals.some((s: any) => s.type === "dossier_viewed");
    const hasMeeting = signals.some((s: any) => s.type === "meeting_scheduled");
    const hasNoResponse = signals.some((s: any) => s.type === "no_response_72h");
    const hasWAReply = signals.some((s: any) => s.type === "whatsapp_replied");

    const viewedAt = signals.find((s: any) => s.type === "dossier_viewed")?.createdAt;
    const hoursSinceViewed = viewedAt
        ? (now - new Date(viewedAt).getTime()) / 3_600_000
        : null;

    const lastSig = signals.length > 0 ? new Date(signals[signals.length - 1].createdAt) : null;

    const decision = evaluateFollowUp({
        hasViewed, hasMeetingBooked: hasMeeting, hasNoResponse72h: hasNoResponse,
        hasWhatsappReplied: hasWAReply, lastSignalAt: lastSig, hoursSinceViewed,
    });

    logger.info("[FollowUp] Decision", { dealPacketId, action: decision.action, reason: decision.reason });

    // Log into ActionQueue or enqueue WhatsApp send — stub implementation
    // The actual enqueueing would call the Orchestrator's enqueueAction
    // For now we log and record the planned action
    await (prisma as any).auditEvent.create({
        data: {
            assessmentId: packet.assessmentId,
            organizationId: packet.orgId,
            action: `followup:${decision.action}`,
            details: decision.reason,
        },
    }).catch(() => null);
}
