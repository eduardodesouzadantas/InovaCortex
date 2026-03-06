/**
 * lib/authority/stub-proof-pack.ts
 * V21: Pure, zero-dependency STUB proof-pack generator.
 * Uses REAL metrics (passed in), never invents numbers.
 */

export interface ProofMetrics {
    sector: string;                  // e.g. "clínica estética"
    teamSizeLabel: string;           // e.g. "10-20 pessoas"
    monthlyEconomy: number;          // R$
    monthlyRevenue: number;          // R$
    hoursSaved: number;              // per month
    paybackMonths: number;
    diasGoLive: number;
    modules: string[];               // e.g. ["Atendimento IA", "CRM Automatizado"]
    anonLabel: string;               // result of anonymizeWorkspaceContext
}

export interface ProofPack {
    case_study_md: string;
    linkedin_post: string;
    stat_card: string[];
}

export function buildStubProofPack(metrics: ProofMetrics): ProofPack {
    const {
        anonLabel, monthlyEconomy, monthlyRevenue,
        hoursSaved, paybackMonths, diasGoLive, modules,
    } = metrics;

    const economyFmt = formatBRL(monthlyEconomy);
    const revenueFmt = formatBRL(monthlyRevenue);
    const modulesStr = modules.slice(0, 3).join(", ");

    // ── Case Study (markdown) ─────────────────────────────────────────────────
    const case_study_md = `# Case: ${anonLabel}

## Contexto
${anonLabel} implementou a plataforma InovaCortex integrando ${modulesStr}.
O go-live foi concluído em **${diasGoLive} dias**.

## Desafio
Processos manuais consumindo tempo e gerando inconsistências no atendimento ao cliente.

## Solução
Implantação dos módulos: **${modulesStr}**.

## Resultados
| Métrica | Resultado |
|---|---|
| Economia mensal estimada | ${economyFmt} |
| Receita adicional estimada | ${revenueFmt} |
| Horas recuperadas/mês | ${hoursSaved}h |
| Payback estimado | ${paybackMonths} meses |

## Conclusão
${anonLabel} agora opera com processos automatizados, reduzindo retrabalho e aumentando a capacidade de atendimento sem aumentar o time.

---
*Case anonimizado. Dados de ROI baseados em projeção acordada no escopo do projeto.*
`;

    // ── LinkedIn Post ─────────────────────────────────────────────────────────
    const linkedin_post = `📊 Case real: ${anonLabel}

Implementamos ${modulesStr} e os resultados em ${diasGoLive} dias:

→ ${economyFmt} de economia operacional/mês
→ ${hoursSaved}h recuperadas pela equipe todo mês
→ Payback estimado em ${paybackMonths} meses

Sem exagero. Sem promessas. Números do próprio escopo do projeto.

Se você quer resultados parecidos, me chama. 👇

#automação #IA #casesucesso #B2B`;

    // ── Stat Card (3-5 numbers) ───────────────────────────────────────────────
    const stat_card: string[] = [
        `⏱ ${diasGoLive} dias para go-live`,
        `💰 ${economyFmt}/mês em economia operacional`,
        `⏰ ${hoursSaved}h recuperadas por mês`,
        `📈 Payback em ${paybackMonths} meses`,
        `🚀 ${modules.length} módulo${modules.length !== 1 ? "s" : ""} implementado${modules.length !== 1 ? "s" : ""}`,
    ].filter(Boolean).slice(0, 5);

    return { case_study_md, linkedin_post, stat_card };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatBRL(value: number): string {
    if (value >= 1000) {
        return `R$ ${(value / 1000).toFixed(1).replace(".", ",")}k`;
    }
    return `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
}

export function buildAnonLabel(
    sector: string,
    teamSizeLabel: string,
    level: "full" | "sector_only" | "size_only" | "none",
    realName?: string,
): string {
    switch (level) {
        case "full": return `${sector} com ${teamSizeLabel}`;
        case "sector_only": return sector;
        case "size_only": return `empresa com ${teamSizeLabel}`;
        case "none": return realName ?? `${sector} com ${teamSizeLabel}`;
    }
}
