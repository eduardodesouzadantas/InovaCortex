/**
 * lib/whatsapp/response-builder.ts
 * Converts structured AI responses (CommandResult / ChatAnswer) into
 * WhatsApp-friendly plain text with Bold (*text*) formatting.
 *
 * Output format:
 *   *Title*
 *
 *   *Resumo*
 *   ...text...
 *
 *   *Dados*
 *   • Key: Value
 *
 *   *Ações*
 *   • Ação 1
 *
 *   *Atalhos*
 *   /revenue · /leaks · /today
 */

const MAX_CHARS = 4000; // WhatsApp limit

// ─── Core Builder ─────────────────────────────────────────────────────────────

export interface StructuredResponse {
    title?: string;
    resumo?: string;
    dados?: Record<string, any>;
    acoes?: string[];
    atalhos?: string[];
}

/**
 * Build a WhatsApp message from any structured AI response.
 * Works for both CommandResult and ChatAnswer.
 */
export function buildWhatsAppResponse(res: StructuredResponse): string {
    const sections: string[] = [];

    // Title
    if (res.title) {
        sections.push(`🤖 *${res.title}*`);
    }

    // Resumo
    if (res.resumo?.trim()) {
        sections.push(`\n*Resumo*\n${res.resumo.trim()}`);
    }

    // Dados
    const dadosLines = buildDadosSection(res.dados);
    if (dadosLines.length > 0) {
        sections.push(`\n*Dados*\n${dadosLines.join("\n")}`);
    }

    // Ações recomendadas
    const acoes = (res.acoes || []).filter(Boolean).slice(0, 5);
    if (acoes.length > 0) {
        sections.push(`\n*Ações recomendadas*\n${acoes.map(a => `• ${a}`).join("\n")}`);
    }

    // Atalhos
    const atalhos = (res.atalhos || []).filter(Boolean).slice(0, 6);
    if (atalhos.length > 0) {
        sections.push(`\n*Atalhos*\n${atalhos.join("  ·  ")}`);
    }

    return sections.join("\n").slice(0, MAX_CHARS);
}

/**
 * Build chat-style response (no title, more conversational).
 */
export function buildChatResponse(res: StructuredResponse): string {
    const sections: string[] = [];

    if (res.resumo?.trim()) {
        sections.push(res.resumo.trim());
    }

    const acoes = (res.acoes || []).filter(Boolean).slice(0, 3);
    if (acoes.length > 0) {
        sections.push(`\n*Ações recomendadas*\n${acoes.map(a => `• ${a}`).join("\n")}`);
    }

    const atalhos = (res.atalhos || []).filter(Boolean).slice(0, 4);
    if (atalhos.length > 0) {
        sections.push(`\n_Tente: ${atalhos.join(" · ")}_`);
    }

    return sections.join("\n").slice(0, MAX_CHARS);
}

/**
 * Build a simple alert/notification message.
 */
export function buildAlertMessage({
    emoji,
    title,
    body,
    actions,
    footer
}: {
    emoji: string;
    title: string;
    body: string;
    actions?: string[];
    footer?: string;
}): string {
    const lines = [
        `${emoji} *${title}*`,
        "",
        body
    ];

    if (actions?.length) {
        lines.push("", "*Ações*");
        actions.slice(0, 4).forEach(a => lines.push(`• ${a}`));
    }

    if (footer) {
        lines.push("", `_${footer}_`);
    }

    return lines.join("\n").slice(0, MAX_CHARS);
}

/**
 * Build an error or unauthorized message.
 */
export function buildErrorMessage(type: "unauthorized" | "not_found" | "internal" | "no_data"): string {
    const messages: Record<string, string> = {
        unauthorized: "❌ Número não autorizado. Contate seu administrador InovaCortex.",
        not_found: "🔍 Nenhum resultado encontrado. Verifique os dados e tente novamente.",
        internal: "⚠️ Erro interno temporário. Tente novamente em instantes.\n\n_Ou use */help* para ver os comandos._",
        no_data: "📭 Dados insuficientes. Execute */pipeline* ou */revenue* para coletar dados primeiro."
    };
    return messages[type] || messages.internal;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDadosSection(dados?: Record<string, any>): string[] {
    if (!dados || Object.keys(dados).length === 0) return [];

    const lines: string[] = [];
    for (const [key, value] of Object.entries(dados)) {
        if (value === null || value === undefined) continue;

        if (Array.isArray(value)) {
            const preview = value.slice(0, 3).join(", ");
            if (preview) lines.push(`• *${key}:* ${preview}`);
        } else if (typeof value === "object") {
            // Nested object — skip or flatten
            const flat = Object.entries(value)
                .slice(0, 2)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ");
            if (flat) lines.push(`• *${key}:* ${flat}`);
        } else {
            lines.push(`• *${key}:* ${value}`);
        }
    }
    return lines;
}
