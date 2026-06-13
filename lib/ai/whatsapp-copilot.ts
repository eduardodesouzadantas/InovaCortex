import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getOrCreateWhatsAppCopilotSession } from "@/lib/whatsapp/context-service";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import { ChatEngine, type ChatAnswer } from "./chat-engine";
import { CommandEngine, type CommandResult } from "./command-engine";

type CopilotActorContext = {
    orgId: string;
    orgSlug: string;
    userId: string;
    role: string;
};

function formatCommandResponse(result: CommandResult): string {
    const lines: string[] = [];
    lines.push(`*${result.title || "Resultado"}*`);
    lines.push("");

    if (result.resumo) {
        lines.push(result.resumo);
        lines.push("");
    }

    const dataEntries = Object.entries(result.dados);
    if (dataEntries.length > 0) {
        lines.push("*Dados:*");
        for (const [key, value] of dataEntries) {
            if (Array.isArray(value)) {
                lines.push(`- *${key}:* ${value.slice(0, 3).map(String).join(" | ")}`);
            } else {
                lines.push(`- *${key}:* ${String(value)}`);
            }
        }
        lines.push("");
    }

    if (result.acoes.length > 0) {
        lines.push("*Acoes:*");
        result.acoes.slice(0, 5).forEach((action) => lines.push(`-> ${action}`));
        lines.push("");
    }

    if (result.atalhos.length > 0) {
        lines.push(`Proximos: ${result.atalhos.join(" | ")}`);
    }

    return lines.join("\n").slice(0, 4000);
}

function formatChatResponse(result: ChatAnswer): string {
    const lines: string[] = [];
    if (result.resumo) {
        lines.push(result.resumo);
        lines.push("");
    }

    if (result.acoes.length > 0) {
        lines.push("*Acoes recomendadas:*");
        result.acoes.slice(0, 3).forEach((action) => lines.push(`-> ${action}`));
    }

    return lines.join("\n").slice(0, 4000);
}

async function resolveOrgForSender(phone: string): Promise<CopilotActorContext | null> {
    const allowlist = process.env.WHATSAPP_COPILOT_PHONES?.split(",").map((item) => item.trim()).filter(Boolean) || [];
    const allowedOrgSlug = process.env.WHATSAPP_COPILOT_ORG_SLUG?.trim();

    if (!allowedOrgSlug || !allowlist.includes(phone)) {
        return null;
    }

    const org = await prisma.organization.findUnique({
        where: { slug: allowedOrgSlug },
        select: { id: true, slug: true },
    });
    if (!org) {
        return null;
    }

    const user = await prisma.user.findFirst({
        where: {
            organizationId: org.id,
            role: { in: ["owner", "admin"] },
        },
        orderBy: { createdAt: "asc" },
        select: {
            id: true,
            role: true,
        },
    });

    return {
        orgId: org.id,
        orgSlug: org.slug,
        userId: user?.id || "system",
        role: user?.role || "admin",
    };
}

function resolveChatRole(role: string): "admin" | "ceo" {
    return role === "owner" || role === "ceo" ? "ceo" : "admin";
}

export async function processCopilotMessage(
    senderPhone: string,
    messageText: string,
    messageId: string,
) {
    try {
        logger.info("WhatsApp Copilot inbound", {
            senderPhone,
            messageId,
            preview: messageText.slice(0, 60),
        });

        const actor = await resolveOrgForSender(senderPhone);
        if (!actor) {
            logger.warn("Copilot unauthorized sender", { senderPhone });
            await sendWhatsAppMessage(
                senderPhone,
                "Numero nao autorizado. Contate seu administrador InovaCortex.",
            );
            return;
        }

        const trimmed = messageText.trim();
        const parsed = CommandEngine.parseInput(trimmed);

        if (parsed.type === "command" && parsed.command) {
            const result = await CommandEngine.executeCommand(
                actor.orgId,
                actor.userId,
                actor.role,
                parsed.command,
                parsed.args,
            );
            await sendWhatsAppMessage(senderPhone, formatCommandResponse(result));
            logger.info("WhatsApp Copilot command response sent", {
                senderPhone,
                command: parsed.command,
                organizationId: actor.orgId,
            });
            return;
        }

        const sessionId = await getOrCreateWhatsAppCopilotSession(actor.orgId, senderPhone);
        const answer = await ChatEngine.answerChat(
            actor.orgId,
            sessionId,
            actor.userId,
            resolveChatRole(actor.role),
            trimmed,
        );

        await sendWhatsAppMessage(senderPhone, formatChatResponse(answer));
        logger.info("WhatsApp Copilot chat response sent", {
            senderPhone,
            organizationId: actor.orgId,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("WhatsApp Copilot error", { senderPhone, messageId, error: message });
        await sendWhatsAppMessage(
            senderPhone,
            "Sistema temporariamente indisponivel. Tente novamente em instantes.",
        ).catch(() => undefined);
    }
}
