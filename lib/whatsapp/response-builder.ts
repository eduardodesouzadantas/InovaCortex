const MAX_CHARS = 4000;

export interface StructuredResponse {
    title?: string;
    resumo?: string;
    dados?: Record<string, unknown>;
    acoes?: string[];
    atalhos?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function stringifyValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.slice(0, 3).map(stringifyValue).filter(Boolean).join(", ");
    if (isRecord(value)) {
        return Object.entries(value)
            .slice(0, 2)
            .map(([key, nestedValue]) => `${key}: ${stringifyValue(nestedValue)}`)
            .filter(Boolean)
            .join(", ");
    }
    return String(value);
}

function buildDadosSection(dados?: Record<string, unknown>): string[] {
    if (!dados || !Object.keys(dados).length) return [];

    const lines: string[] = [];
    for (const [key, value] of Object.entries(dados)) {
        const rendered = stringifyValue(value);
        if (rendered) lines.push(`- *${key}:* ${rendered}`);
    }
    return lines;
}

export function buildWhatsAppResponse(res: StructuredResponse): string {
    const sections: string[] = [];

    if (res.title) sections.push(`*${res.title}*`);
    if (res.resumo?.trim()) sections.push(`\n*Resumo*\n${res.resumo.trim()}`);

    const dadosLines = buildDadosSection(res.dados);
    if (dadosLines.length) sections.push(`\n*Dados*\n${dadosLines.join("\n")}`);

    const acoes = (res.acoes || []).filter(Boolean).slice(0, 5);
    if (acoes.length) sections.push(`\n*Acoes recomendadas*\n${acoes.map((action) => `- ${action}`).join("\n")}`);

    const atalhos = (res.atalhos || []).filter(Boolean).slice(0, 6);
    if (atalhos.length) sections.push(`\n*Atalhos*\n${atalhos.join(" | ")}`);

    return sections.join("\n").slice(0, MAX_CHARS);
}

export function buildChatResponse(res: StructuredResponse): string {
    const sections: string[] = [];

    if (res.resumo?.trim()) sections.push(res.resumo.trim());

    const acoes = (res.acoes || []).filter(Boolean).slice(0, 3);
    if (acoes.length) sections.push(`\n*Acoes recomendadas*\n${acoes.map((action) => `- ${action}`).join("\n")}`);

    const atalhos = (res.atalhos || []).filter(Boolean).slice(0, 4);
    if (atalhos.length) sections.push(`\n_Tente: ${atalhos.join(" | ")}_`);

    return sections.join("\n").slice(0, MAX_CHARS);
}

export function buildAlertMessage({
    emoji,
    title,
    body,
    actions,
    footer,
}: {
    emoji: string;
    title: string;
    body: string;
    actions?: string[];
    footer?: string;
}): string {
    const lines = [`${emoji} *${title}*`, "", body];

    if (actions?.length) {
        lines.push("", "*Acoes*");
        actions.slice(0, 4).forEach((action) => lines.push(`- ${action}`));
    }

    if (footer) lines.push("", `_${footer}_`);
    return lines.join("\n").slice(0, MAX_CHARS);
}

export function buildErrorMessage(type: "unauthorized" | "not_found" | "internal" | "no_data"): string {
    const messages: Record<"unauthorized" | "not_found" | "internal" | "no_data", string> = {
        unauthorized: "Numero nao autorizado. Contate seu administrador InovaCortex.",
        not_found: "Nenhum resultado encontrado. Verifique os dados e tente novamente.",
        internal: "Erro interno temporario. Tente novamente em instantes.\n\nOu use */help* para ver os comandos.",
        no_data: "Dados insuficientes. Execute */pipeline* ou */revenue* para coletar dados primeiro.",
    };

    return messages[type];
}
