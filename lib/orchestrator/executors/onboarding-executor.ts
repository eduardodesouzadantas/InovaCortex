/**
 * lib/orchestrator/executors/onboarding-executor.ts
 * V18: Onboarding Autopilot Executor.
 *
 * Handles 3 action types:
 *  - onboarding_pack_send      → WhatsApp pack to lead (workspace link, checklist, Calendly)
 *  - kickoff_schedule_prompt   → Create Google Calendar Meet event or fallback to Calendly link
 *  - remind_onboarding_48h     → Gentle WhatsApp reminder 48h after payment
 *
 * Anti-chaos (STUB-safe):
 *  - No META token → WhatsAppMessageLog stub/no_token entry, no crash
 *  - No Google connected → Calendly link only, audit kickoffNotConnected
 *  - No Calendly URL → graceful skip with audit
 */

import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { createOrUpdateEventWithMeet } from "@/lib/integrations/google-calendar";
import { logger } from "@/lib/logger";
import type { AgentImplementation, OrchestratorContext } from "@/lib/orchestrator/types";
import { getBaseUrl } from "@/lib/runtime/base-url";
import { writeAuditEvent } from "@/lib/audit";

// ─── Payload (from on-payment-confirmed) ─────────────────────────────────────

export interface OnboardingPayload {
    orgId: string;
    proposalId: string;
    workspaceId: string;
}

// ─── Main Dispatcher ──────────────────────────────────────────────────────────

async function runOnboardingExecutor(
    input: OnboardingPayload,
    ctx: OrchestratorContext,
    actionType: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
    const { orgId, proposalId, workspaceId } = input;

    switch (actionType) {
        case "onboarding_pack_send":
            return sendOnboardingPack(orgId, proposalId, workspaceId);
        case "kickoff_schedule_prompt":
            return scheduleKickoff(orgId, proposalId, workspaceId);
        case "remind_onboarding_48h":
            return sendOnboardingReminder(orgId, proposalId, workspaceId);
        default:
            return { success: false, error: `Unknown onboarding action type: ${actionType}` };
    }
}

// ─── 1. Onboarding Pack ───────────────────────────────────────────────────────

async function sendOnboardingPack(
    orgId: string,
    proposalId: string,
    workspaceId: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
    const context = await loadContext(orgId, proposalId, workspaceId);
    const baseUrl = getBaseUrl();
    const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL ?? null;

    // V19: Client portal URL with magic token
    const portalUrl = context.publicToken
        ? `${baseUrl}/org/${context.orgSlug}/workspace/${workspaceId}?t=${context.publicToken}`
        : `${baseUrl}/org/${context.orgSlug}/admin`;
    const checklist = buildChecklist(context.modules);

    const lines = [
        `🚀 *Bem-vindo(a) ao seu projeto InovaCortex!*`,
        ``,
        `Olá ${context.clientFirstName}! O pagamento foi confirmado e sua implementação começa agora.`,
        ``,
        `📋 *O que você precisa enviar nos primeiros 3 dias:*`,
        ...checklist.map((item, i) => `${i + 1}. ${item}`),
        ``,
        `🏠 *Acesse seu portal de cliente:*`,
        portalUrl,
        ``,
        ...(calendlyUrl ? [`📅 *Agende o kickoff:*`, calendlyUrl] : []),
        ``,
        `⏱️ *SLA:* Respondemos issues críticos em até 72h úteis.`,
        ``,
        `_Nossa equipe entrará em contato em breve. Qualquer dúvida, responda aqui._`,
        ``,
        `_InovaCortex_`,
    ];

    await sendMessageSafe(orgId, context.phone, lines.join("\n"), "onboarding_pack_send");
    await audit(orgId, proposalId, "onboardingSent", { workspaceId, clientPhone: context.phone, portalUrl });

    return { success: true, data: { sent: true, portalUrl, checklistItems: checklist.length } };
}

// ─── 2. Kickoff Scheduling ────────────────────────────────────────────────────

async function scheduleKickoff(
    orgId: string,
    proposalId: string,
    workspaceId: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
    const context = await loadContext(orgId, proposalId, workspaceId);
    const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL ?? null;
    const companyName = context.company;

    // Try Google Calendar + Meet
    const kickoffDate = getNextBusinessDayAt10(new Date());
    const kickoffEnd = new Date(kickoffDate.getTime() + 60 * 60 * 1000); // +1h

    const googleResult = await createOrUpdateEventWithMeet(orgId, {
        calendarId: "primary",
        summary: `Kickoff InovaCortex — ${companyName}`,
        description: `Reunião de kickoff para início da implementação InovaCortex.\n\nProposta: ${proposalId}\nWorkspace: ${workspaceId}`,
        startAt: kickoffDate.toISOString(),
        endAt: kickoffEnd.toISOString(),
        timezone: "America/Sao_Paulo",
        attendees: context.clientEmail ? [context.clientEmail] : [],
        requestId: `kickoff-${proposalId}`,
    }).catch(() => null);

    let message: string;

    if (googleResult?.meetingUrl) {
        await audit(orgId, proposalId, "kickoffScheduled", {
            meetUrl: googleResult.meetingUrl,
            startAt: kickoffDate.toISOString(),
            googleEventId: googleResult.googleEventId,
        });

        message = [
            `📅 *Kickoff Agendado!*`,
            ``,
            `Criamos uma reunião de kickoff para você:`,
            `🗓️ ${kickoffDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} às 10h`,
            `🎥 Meet: ${googleResult.meetingUrl}`,
            ``,
            `O convite foi enviado para ${context.clientEmail ?? "seu e-mail"}.`,
        ].join("\n");
    } else {
        // Fallback: send Calendly link
        await audit(orgId, proposalId, "kickoffNotConnected", {
            reason: "Google Calendar not connected",
            calendlyUrl: calendlyUrl ?? "not-set",
        });

        message = calendlyUrl
            ? [
                `📅 *Agende o Kickoff*`,
                ``,
                `Por favor, escolha o melhor horário para iniciarmos:`,
                calendlyUrl,
            ].join("\n")
            : `📅 Nossa equipe entrará em contato para agendar o kickoff — fique atento(a)!`;
    }

    await sendMessageSafe(orgId, context.phone, message, "kickoff_schedule_prompt");

    return {
        success: true,
        data: {
            googleScheduled: !!googleResult?.meetingUrl,
            meetUrl: googleResult?.meetingUrl ?? null,
            calendlyFallback: !googleResult && !!calendlyUrl,
        },
    };
}

// ─── 3. 48h Reminder ─────────────────────────────────────────────────────────

async function sendOnboardingReminder(
    orgId: string,
    proposalId: string,
    workspaceId: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
    const context = await loadContext(orgId, proposalId, workspaceId);
    const baseUrl = getBaseUrl();
    const portalUrl = context.publicToken
        ? `${baseUrl}/org/${context.orgSlug}/workspace/${workspaceId}?t=${context.publicToken}`
        : `${baseUrl}/org/${context.orgSlug}/admin`;

    // Only send if checklist is still incomplete
    const pendingItems = await (prisma as any).integrationChecklistItem.count({
        where: { workspaceId, organizationId: orgId, status: "pending" },
    });

    if (pendingItems === 0) {
        await audit(orgId, proposalId, "remind_onboarding_48h_skipped", { reason: "checklist_complete" });
        return { success: true, data: { skipped: true, reason: "checklist_complete" } };
    }

    const message = [
        `⏰ *Lembrete — Onboarding InovaCortex*`,
        ``,
        `Olá ${context.clientFirstName}! Você ainda tem ${pendingItems} item(ns) pendente(s) no checklist de integração.`,
        ``,
        `Acesse seu portal para continuar:`,
        portalUrl,
        ``,
        `Qualquer dúvida, responda aqui. Estamos à disposição! 🚀`,
    ].join("\n");

    await sendMessageSafe(orgId, context.phone, message, "remind_onboarding_48h");
    await audit(orgId, proposalId, "onboardingReminderSent", { workspaceId, pendingItems });

    return { success: true, data: { sent: true, pendingItems } };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface OnboardingContext {
    orgSlug: string;
    company: string;
    clientFirstName: string;
    clientEmail: string | null;
    phone: string | null;
    modules: string[];
    publicToken: string | null;
}

async function loadContext(orgId: string, proposalId: string, workspaceId: string): Promise<OnboardingContext> {
    const [org, proposal, workspace] = await Promise.all([
        (prisma as any).organization.findUnique({ where: { id: orgId }, select: { slug: true, name: true } }).catch(() => null),
        (prisma as any).proposal.findUnique({
            where: { id: proposalId },
            include: { assessment: { select: { company: true, name: true, email: true, phone: true } } },
        }).catch(() => null),
        (prisma as any).clientWorkspace.findUnique({
            where: { id: workspaceId },
            select: { workspacePublicToken: true },
        }).catch(() => null),
    ]);

    const assessment = proposal?.assessment;
    const modules: string[] = (() => {
        try { return JSON.parse(proposal?.modulesEnabled ?? proposal?.modules ?? "[]").map((m: any) => m.id ?? m).filter(Boolean); }
        catch { return []; }
    })();

    return {
        orgSlug: org?.slug ?? orgId,
        company: assessment?.company ?? "Cliente",
        clientFirstName: assessment?.name?.split(" ")[0] ?? "Cliente",
        clientEmail: assessment?.email ?? null,
        phone: assessment?.phone ?? null,
        modules,
        publicToken: workspace?.workspacePublicToken ?? null,
    };
}

function buildChecklist(modules: string[]): string[] {
    const base = [
        "Logo em alta resolução (PNG/SVG)",
        "Acesso administrativo ao WhatsApp Business / Meta Business Suite",
        "Nome de domínio configurado (se aplicável)",
        "Indicação do ponto focal do projeto (nome + e-mail)",
    ];

    const moduleMap: Record<string, string[]> = {
        whatsapp_bot: ["Token de acesso permanente do WhatsApp Business API"],
        crm_integration: ["Credenciais do CRM atual (somente leitura)"],
        email_automation: ["Acesso à plataforma de e-mail marketing"],
        analytics: ["Acesso ao Google Analytics / Meta Pixel"],
    };

    const extras = modules.flatMap(m => moduleMap[m] ?? []);
    return [...base, ...extras];
}

function getNextBusinessDayAt10(from: Date): Date {
    const d = new Date(from);
    d.setDate(d.getDate() + 3); // 3 days from now
    // Skip weekends
    const day = d.getDay();
    if (day === 6) d.setDate(d.getDate() + 2);
    if (day === 0) d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
}

async function sendMessageSafe(orgId: string, phone: string | null, body: string, actionType: string) {
    if (!phone) {
        logger.info(`[ONBOARDING] No phone for ${actionType} — skipping WhatsApp`, { orgId });
        await writeAuditEvent({
            organizationId: orgId,
            action: "onboardingSkippedNoPhone",
            details: {
                reason: "no_phone",
                actionType,
                source: "system:onboarding-executor",
            },
            strict: true,
            context: { actionType },
        });
        return;
    }
    try {
        await sendWhatsAppMessage(phone, body);
    } catch (err: any) {
        logger.error(`[ONBOARDING] WhatsApp send failed (non-fatal)`, { error: err.message, actionType, orgId });
    }
}

async function audit(orgId: string, proposalId: string, action: string, details: object) {
    await writeAuditEvent({
        organizationId: orgId,
        action,
        details: {
            proposalId,
            source: "system:onboarding-executor",
            ...details,
        },
        strict: true,
        context: { proposalId },
    });
}

// ─── Agent Registration ───────────────────────────────────────────────────────

export const OnboardingAgent: AgentImplementation = {
    name: "OnboardingAgent",
    run: (input: any, ctx: OrchestratorContext) =>
        runOnboardingExecutor(input as OnboardingPayload, ctx, ctx.actionType ?? "onboarding_pack_send"),
};
