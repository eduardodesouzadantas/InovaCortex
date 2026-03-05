import { CommandEngine } from "@/lib/ai/command-engine";
import { ChatEngine } from "@/lib/ai/chat-engine";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { logger } from "@/lib/logger";
import { buildWhatsAppResponse, buildChatResponse, buildErrorMessage } from "./response-builder";
import { canExecuteCommand, getDeniedMessage, type WhatsAppRole } from "./rbac";

/**
 * WhatsApp Command Parser & Router (V34)
 *
 * Supported commands:
 *   /revenue   /leaks     /today    /pipeline
 *   /growth    /playbook  /client   /objections
 *   /test-strategy        /help
 *
 * Anything else → ChatEngine (free-form)
 */

// All valid commands (used for autocomplete suggestions in /help)
const KNOWN_COMMANDS = [
    "/revenue", "/leaks", "/today", "/pipeline",
    "/growth", "/playbook", "/client", "/objections",
    "/strategy", "/experiment", "/focus", "/help", "/run"
];

export interface ParsedInput {
    type: "command" | "chat";
    command?: string;
    args?: string;
    raw: string;
}

/**
 * Parse a raw WhatsApp message into a typed ParsedInput.
 */
export function parseWhatsAppInput(text: string): ParsedInput {
    const trimmed = text.trim();

    if (!trimmed.startsWith("/")) {
        return { type: "chat", raw: trimmed };
    }

    // Find the command token (first word)
    const spaceIdx = trimmed.indexOf(" ");
    const command = spaceIdx === -1 ? trimmed.toLowerCase() : trimmed.slice(0, spaceIdx).toLowerCase();
    const args = spaceIdx === -1 ? undefined : trimmed.slice(spaceIdx + 1).trim() || undefined;

    return { type: "command", command, args, raw: trimmed };
}

/**
 * Format a CommandEngine output for WhatsApp.
 * Delegates to the shared response-builder.
 */
function formatCommand(result: any): string {
    return buildWhatsAppResponse(result);
}

/**
 * Format a ChatEngine output for WhatsApp.
 * Delegates to the shared response-builder.
 */
function formatChat(result: any): string {
    return buildChatResponse(result);
}

/**
 * Suggest closest command when an unknown /cmd is typed.
 */
function suggestCommand(unknown: string): string {
    // Find if any known command starts similarly
    const match = KNOWN_COMMANDS.find(c => c.startsWith(unknown.slice(0, 4)));
    return match
        ? `❓ Comando *${unknown}* não encontrado.\n\n💡 Você quis dizer *${match}*?\n\nDigite */help* para ver todos os comandos.`
        : `❓ Comando *${unknown}* não reconhecido.\n\nDigite */help* para ver todos os comandos disponíveis.`;
}

/**
 * Main entry point: parse → route → send reply.
 */
export async function routeWhatsAppMessage({
    from,
    text,
    orgId,
    userId,
    role,
    sessionId
}: {
    from: string;
    text: string;
    orgId: string;
    userId: string;
    role: string;
    sessionId: string;
}) {
    const parsed = parseWhatsAppInput(text);

    try {
        // ── COMMAND PATH ────────────────────────────────────────────────────────
        if (parsed.type === "command" && parsed.command) {
            // Validate against known commands
            if (!KNOWN_COMMANDS.includes(parsed.command)) {
                await sendWhatsAppMessage(from, suggestCommand(parsed.command));
                return;
            }

            // RBAC enforcement
            if (!canExecuteCommand(role as WhatsAppRole, parsed.command)) {
                await sendWhatsAppMessage(from, getDeniedMessage(parsed.command, role as WhatsAppRole));
                return;
            }

            logger.info(`WhatsApp command: ${parsed.command} [${from}] role:${role}`);

            const result = await CommandEngine.executeCommand(
                orgId, userId, role,
                parsed.command,
                parsed.args
            );

            await sendWhatsAppMessage(from, formatCommand(result));
            return;
        }

        // ── CHAT PATH ───────────────────────────────────────────────────
        logger.info(`WhatsApp chat: "${text.slice(0, 40)}..." [${from}]`);

        const result = await ChatEngine.answerChat(
            orgId, sessionId, userId,
            role as "admin" | "ceo",
            text.trim()
        );

        await sendWhatsAppMessage(from, formatChat(result));

    } catch (error: any) {
        logger.error(`WhatsApp router error: ${error.message}`);
        await sendWhatsAppMessage(from, buildErrorMessage("internal"));
    }
}
