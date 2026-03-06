import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { CommandEngine } from "./command-engine";
import { ChatEngine } from "./chat-engine";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

/**
 * AI WhatsApp Copilot (V34)
 * Routes incoming WhatsApp messages to CommandEngine or ChatEngine,
 * then formats and sends the structured response back.
 */

export interface CopilotContext {
    orgId: string;
    orgSlug: string;
    senderPhone: string; // E.164
    messageId: string;
}

/**
 * Authorized senders: must match a User phone in the org.
 * If WHATSAPP_COPILOT_PHONES env is set, uses that allowlist instead.
 */
async function resolveOrgForSender(phone: string): Promise<{ orgId: string; orgSlug: string; userId: string; role: string } | null> {
    // Check env allowlist first
    const allowlist = process.env.WHATSAPP_COPILOT_PHONES?.split(",").map(p => p.trim()) || [];
    const allowedOrgSlug = process.env.WHATSAPP_COPILOT_ORG_SLUG;

    if (allowlist.length > 0 && allowedOrgSlug) {
        if (!allowlist.includes(phone)) return null;
        const org = await prisma.organization.findUnique({
            where: { slug: allowedOrgSlug },
            select: { id: true, slug: true }
        });
        if (!org) return null;
        // Find matching user or use system user
        const user = await (prisma as any).user.findFirst({
            where: { organizationId: org.id, role: { in: ["owner", "admin"] } }
        });
        return { orgId: org.id, orgSlug: org.slug, userId: user?.id || "system", role: user?.role || "admin" };
    }

    return null;
}

/**
 * Get or create a WhatsApp-specific chat session for this sender.
 */
async function getOrCreateSession(orgId: string, senderPhone: string): Promise<string> {
    const sessionTag = `wa_${senderPhone}`;
    const existing = await (prisma as any).aIChatSession.findFirst({
        where: { organizationId: orgId, title: sessionTag },
        orderBy: { updatedAt: "desc" }
    });

    if (existing) return existing.id;

    const session = await (prisma as any).aIChatSession.create({
        data: {
            organizationId: orgId,
            title: sessionTag,
            mode: "whatsapp_copilot"
        }
    });
    return session.id;
}

/**
 * Format a CommandResult into WhatsApp-friendly plain text.
 */
function formatCommandResponse(result: any): string {
    const lines: string[] = [];
    lines.push(`🤖 *${result.title || "Resultado"}*`);
    lines.push("");
    if (result.resumo) lines.push(result.resumo);
    lines.push("");

    if (result.dados && Object.keys(result.dados).length > 0) {
        lines.push("📊 *Dados:*");
        for (const [key, value] of Object.entries(result.dados)) {
            if (Array.isArray(value)) {
                lines.push(`• *${key}:* ${(value as any[]).slice(0, 3).join(" | ")}`);
            } else {
                lines.push(`• *${key}:* ${value}`);
            }
        }
        lines.push("");
    }

    if (result.acoes?.length > 0) {
        lines.push("⚡ *Ações:*");
        result.acoes.slice(0, 5).forEach((a: string) => lines.push(`→ ${a}`));
        lines.push("");
    }

    if (result.atalhos?.length > 0) {
        lines.push(`💡 Próximos: ${result.atalhos.join(" · ")}`);
    }

    return lines.join("\n").slice(0, 4000); // WhatsApp limit
}

/**
 * Format a ChatAnswer into WhatsApp-friendly plain text.
 */
function formatChatResponse(result: any): string {
    const lines: string[] = [];
    if (result.resumo) lines.push(result.resumo);
    lines.push("");

    if (result.acoes?.length > 0) {
        lines.push("⚡ *Ações recomendadas:*");
        result.acoes.slice(0, 3).forEach((a: string) => lines.push(`→ ${a}`));
    }

    return lines.join("\n").slice(0, 4000);
}

/**
 * Main entry point: process an incoming WhatsApp message.
 */
export async function processCopilotMessage(
    senderPhone: string,
    messageText: string,
    messageId: string
) {
    try {
        logger.info(`WhatsApp Copilot: [${senderPhone}] "${messageText.slice(0, 60)}"`);

        // 1. Authorize sender
        const ctx = await resolveOrgForSender(senderPhone);
        if (!ctx) {
            logger.warn(`Copilot: unauthorized sender ${senderPhone}`);
            await sendWhatsAppMessage(senderPhone,
                "❌ Número não autorizado. Contate seu administrador InovaCortex."
            );
            return;
        }

        const { orgId, orgSlug, userId, role } = ctx;
        const trimmed = messageText.trim();

        // 2. Route to CommandEngine (if starts with /)
        const { type, command, args } = CommandEngine.parseInput(trimmed);

        if (type === "command" && command) {
            const result = await CommandEngine.executeCommand(orgId, userId, role, command, args);
            const reply = formatCommandResponse(result);
            await sendWhatsAppMessage(senderPhone, reply);
            logger.info(`Copilot command response sent: ${command} → ${senderPhone}`);
            return;
        }

        // 3. Free-form → ChatEngine
        const sessionId = await getOrCreateSession(orgId, senderPhone);
        const chatResult = await ChatEngine.answerChat(orgId, sessionId, userId, role as "admin" | "ceo", trimmed);
        const reply = formatChatResponse(chatResult);
        await sendWhatsAppMessage(senderPhone, reply);
        logger.info(`Copilot chat response sent → ${senderPhone}`);

    } catch (error: any) {
        logger.error(`WhatsApp Copilot Error: ${error.message}`);
        await sendWhatsAppMessage(senderPhone,
            "⚠️ Sistema temporariamente indisponível. Tente novamente em instantes."
        ).catch(() => { });
    }
}
