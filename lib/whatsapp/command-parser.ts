import type { ChatAnswer } from "@/lib/ai/chat-engine";
import type { CommandResult } from "@/lib/ai/command-engine";
import { ChatEngine } from "@/lib/ai/chat-engine";
import { CommandEngine } from "@/lib/ai/command-engine";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { logger } from "@/lib/logger";
import { buildChatResponse, buildErrorMessage, buildWhatsAppResponse } from "./response-builder";
import { canExecuteCommand, getDeniedMessage, type WhatsAppRole } from "./rbac";

const KNOWN_COMMANDS = [
    "/revenue",
    "/leaks",
    "/today",
    "/pipeline",
    "/growth",
    "/playbook",
    "/client",
    "/objections",
    "/strategy",
    "/experiment",
    "/focus",
    "/help",
    "/run",
] as const;

export interface ParsedInput {
    type: "command" | "chat";
    command?: string;
    args?: string;
    raw: string;
}

function normalizeWhatsAppRole(role: string): WhatsAppRole {
    if (role === "ceo") return "ceo";
    if (role === "admin" || role === "owner") return "admin";
    return "sales";
}

export function parseWhatsAppInput(text: string): ParsedInput {
    const trimmed = text.trim();
    if (!trimmed.startsWith("/")) return { type: "chat", raw: trimmed };

    const spaceIdx = trimmed.indexOf(" ");
    const command = spaceIdx === -1 ? trimmed.toLowerCase() : trimmed.slice(0, spaceIdx).toLowerCase();
    const args = spaceIdx === -1 ? undefined : trimmed.slice(spaceIdx + 1).trim() || undefined;
    return { type: "command", command, args, raw: trimmed };
}

function formatCommand(result: CommandResult): string {
    return buildWhatsAppResponse(result);
}

function formatChat(result: ChatAnswer): string {
    return buildChatResponse(result);
}

function suggestCommand(unknown: string): string {
    const match = KNOWN_COMMANDS.find((command) => command.startsWith(unknown.slice(0, 4)));
    return match
        ? `Comando *${unknown}* nao encontrado.\n\nVoce quis dizer *${match}*?\n\nDigite */help* para ver todos os comandos.`
        : `Comando *${unknown}* nao reconhecido.\n\nDigite */help* para ver todos os comandos disponiveis.`;
}

export async function routeWhatsAppMessage({
    from,
    text,
    orgId,
    userId,
    role,
    sessionId,
}: {
    from: string;
    text: string;
    orgId: string;
    userId: string;
    role: string;
    sessionId: string;
}) {
    const parsed = parseWhatsAppInput(text);
    const whatsappRole = normalizeWhatsAppRole(role);

    try {
        if (parsed.type === "command" && parsed.command) {
            if (!KNOWN_COMMANDS.includes(parsed.command as typeof KNOWN_COMMANDS[number])) {
                await sendWhatsAppMessage(from, suggestCommand(parsed.command));
                return;
            }

            if (!canExecuteCommand(whatsappRole, parsed.command)) {
                await sendWhatsAppMessage(from, getDeniedMessage(parsed.command, whatsappRole));
                return;
            }

            logger.info(`WhatsApp command: ${parsed.command} [${from}] role:${role}`);
            const result = await CommandEngine.executeCommand(orgId, userId, role, parsed.command, parsed.args);
            await sendWhatsAppMessage(from, formatCommand(result));
            return;
        }

        logger.info(`WhatsApp chat: "${text.slice(0, 40)}..." [${from}]`);
        const result = await ChatEngine.answerChat(
            orgId,
            sessionId,
            userId,
            role === "ceo" ? "ceo" : "admin",
            text.trim(),
        );

        await sendWhatsAppMessage(from, formatChat(result));
    } catch (error: unknown) {
        logger.error("WhatsApp router error", {
            error: error instanceof Error ? error.message : String(error),
        });
        await sendWhatsAppMessage(from, buildErrorMessage("internal"));
    }
}
