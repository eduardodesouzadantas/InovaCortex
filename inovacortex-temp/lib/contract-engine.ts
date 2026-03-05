/**
 * lib/contract-engine.ts
 * V18: Deterministic Contract Generator — zero LLM.
 *
 * Generates a professional service agreement HTML from:
 *  - Proposal (modules, pricing, timeline)
 *  - Assessment (company, contact details)
 *  - Org (service provider identity)
 *
 * Guardrails:
 *  - No absolute result promises
 *  - Focus on process and metrics
 *  - Simple electronic signature (name + email + timestamp)
 */

import crypto from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContractInput {
    proposal: {
        id: string;
        version: number;
        modules: string;           // JSON string
        pricingEstimate: string;   // JSON string
        roiSnapshot?: string;      // JSON string, optional
    };
    assessment: {
        id: string;
        company: string;
        name: string;
        email: string;
        phone?: string | null;
    };
    orgName?: string;
}

export interface ContractOutput {
    publicSlug: string;
    htmlBody: string;
    summaryBullets: string[];
}

// ─── Main Function ────────────────────────────────────────────────────────────

export function generateContract(input: ContractInput): ContractOutput {
    const { proposal, assessment, orgName = "InovaCortex" } = input;

    const modules: any[] = safeJsonParse(proposal.modules, []).filter((m: any) => m.included !== false);
    const pricing: any = safeJsonParse(proposal.pricingEstimate, { minBRL: 0, maxBRL: 0, basis: "" });
    const totalWeeks = modules.reduce((sum: number, m: any) => sum + (m.estimatedWeeks ?? 0), 0) + 2;
    const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    // Generate stable slug from proposalId
    const slugHash = crypto.createHash("sha256").update(`contract-${proposal.id}-v${proposal.version}`).digest("hex").slice(0, 12);
    const publicSlug = `ctr-${slugHash}`;

    const moduleRows = modules.map((m: any, i: number) => `
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600">${i + 1}. ${m.title}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#4b5563">${m.description}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;white-space:nowrap">${m.estimatedWeeks ?? "—"} sem.</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap">${formatBRL(m.basePrice ?? 0)}</td>
        </tr>`).join("");

    const deliverablesList = modules.flatMap((m: any) => m.deliverables ?? []).map((d: string) => `<li style="margin:4px 0">${d}</li>`).join("");

    const htmlBody = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Contrato de Prestação de Serviços — ${orgName} × ${assessment.company}</title>
<style>
  body { font-family: 'Georgia', serif; color: #1a1a1a; line-height: 1.7; max-width: 860px; margin: 0 auto; padding: 40px 24px; }
  h1 { font-size: 22px; text-align: center; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  h2 { font-size: 13px; font-weight: normal; text-align: center; color: #6b7280; margin-bottom: 40px; }
  h3 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 2px solid #1a1a1a; padding-bottom: 4px; margin: 32px 0 16px; }
  p { margin: 10px 0; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0; }
  th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 20px 0; }
  .party-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; font-size: 13px; }
  .clause-note { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; font-size: 13px; border-radius: 0 4px 4px 0; }
  .signature-block { border: 2px dashed #d1d5db; border-radius: 8px; padding: 24px; margin-top: 40px; background: #f9fafb; }
  .annex { margin-top: 40px; border-top: 2px solid #e5e7eb; padding-top: 24px; }
  @media (max-width: 600px) { .parties { grid-template-columns: 1fr; } }
</style>
</head>
<body>

<h1>Contrato de Prestação de Serviços</h1>
<h2>Automação Inteligente e Implementação de IA — ${today}</h2>

<div class="parties">
  <div class="party-box">
    <strong>CONTRATADA</strong><br>
    ${orgName}<br>
    <small>Prestadora de Serviços</small>
  </div>
  <div class="party-box">
    <strong>CONTRATANTE</strong><br>
    ${assessment.company}<br>
    Representado por: ${assessment.name}<br>
    ${assessment.email}${assessment.phone ? `<br>${assessment.phone}` : ""}
  </div>
</div>

<h3>Cláusula 1 — Objeto do Contrato</h3>
<p>O presente contrato tem por objeto a prestação de serviços de automação inteligente, implementação de agentes de IA e integração de sistemas, conforme os módulos e entregas descritos no Anexo A deste instrumento, previamente acordados na proposta comercial versão ${proposal.version}.</p>

<h3>Cláusula 2 — Escopo e Entregáveis</h3>
<p>Os serviços compreendem os seguintes módulos:</p>
<ul style="font-size:14px;padding-left:20px">
${deliverablesList}
</ul>
<p>O detalhamento completo de módulos, descrições e prazos consta no <strong>Anexo A</strong>.</p>

<h3>Cláusula 3 — Prazo de Implementação</h3>
<p>O prazo estimado de implementação é de <strong>${totalWeeks} semanas</strong> a partir da data de kickoff, definida em comum acordo após a confirmação do pagamento. O kickoff será agendado em até 5 dias úteis após a confirmação.</p>
<p>Prazos podem ser revisados em caso de atraso na entrega de acessos, conteúdos ou aprovações por parte do Contratante, conforme Cláusula 4.</p>

<h3>Cláusula 4 — Obrigações do Contratante</h3>
<p>Para viabilizar a implementação dentro do prazo, o Contratante se compromete a:</p>
<ul style="font-size:14px;padding-left:20px">
  <li>Fornecer os acessos a sistemas, APIs e plataformas necessários em até 3 dias úteis após o kickoff;</li>
  <li>Designar um ponto focal responsável por aprovações e respostas com disponibilidade mínima de 1h por semana;</li>
  <li>Aprovar ou fornecer feedback sobre entregas em até <strong>5 dias úteis</strong> após cada entrega;</li>
  <li>Disponibilizar logotipo, identidade visual e materiais de comunicação quando necessário;</li>
  <li>Garantir que os dados fornecidos estão em conformidade com a LGPD.</li>
</ul>

<h3>Cláusula 5 — Privacidade e Confidencialidade</h3>
<p>As partes se comprometem a manter em sigilo todas as informações confidenciais trocadas durante a vigência deste contrato. Dados de clientes do Contratante serão tratados conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). A Contratada não compartilhará dados com terceiros sem autorização expressa.</p>

<h3>Cláusula 6 — SLA e Qualidade</h3>
<p>A Contratada se compromete a:</p>
<ul style="font-size:14px;padding-left:20px">
  <li>Responder a questões críticas de operação em até <strong>72 horas úteis</strong>;</li>
  <li>Comunicar riscos ou impedimentos proativamente, antes que impactem o prazo;</li>
  <li>Documentar todas as automações e integrações implementadas.</li>
</ul>
<div class="clause-note">
  ⚠️ <strong>Sem promessa de resultados absolutos:</strong> Os resultados projetados (ROI, economia, conversão) são estimativas baseadas em benchmarks do setor e nos dados do diagnóstico. O desempenho real depende de fatores externos ao controle da Contratada, incluindo adoção interna, qualidade dos dados e condições de mercado.
</div>

<h3>Cláusula 7 — Cancelamento e Reembolso</h3>
<p><strong>7.1</strong> O Contratante pode cancelar o contrato em até <strong>7 dias corridos</strong> após a assinatura, desde que nenhuma implementação tenha sido iniciada, com reembolso integral.</p>
<p><strong>7.2</strong> Após início da implementação, cancelamentos resultarão no pagamento proporcional às entregas realizadas até a data do cancelamento.</p>
<p><strong>7.3</strong> A Contratada pode suspender os serviços em caso de inadimplência superior a 15 dias, sem prejuízo de cobrança pelos valores devidos.</p>

<h3>Cláusula 8 — Aceite Eletrônico</h3>
<p>Este contrato pode ser firmado por meio de assinatura eletrônica simples, conforme o Art. 10 da MP 2.200-2/2001 e as disposições da Lei nº 14.063/2020. O aceite eletrônico, com registro de nome, e-mail e timestamp, tem o mesmo valor jurídico que a assinatura física entre as partes.</p>

<div class="signature-block" id="signature-block">
  <p style="font-weight:bold;margin-bottom:16px">✍️ Assinatura Eletrônica</p>
  <p style="font-size:13px;color:#6b7280">Ao preencher e confirmar abaixo, o Contratante declara ter lido e concordado com todos os termos deste contrato.</p>
  <div style="margin-top:24px;display:grid;gap:12px;font-size:13px">
    <div>Nome completo: ___________________________________</div>
    <div>E-mail: ___________________________________</div>
    <div>Data/Hora: ___________________________________</div>
  </div>
</div>

<div class="annex">
  <h3>Anexo A — Módulos e Entregas</h3>
  <table>
    <thead>
      <tr>
        <th>Módulo</th>
        <th>Descrição</th>
        <th style="text-align:center">Prazo</th>
        <th style="text-align:right">Base</th>
      </tr>
    </thead>
    <tbody>
      ${moduleRows}
    </tbody>
  </table>
</div>

<div class="annex">
  <h3>Anexo B — Investimento</h3>
  <table>
    <thead>
      <tr><th>Item</th><th style="text-align:right">Valor</th></tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">Implementação — ${modules.length} Módulos (${pricing.basis || "conforme escopo"})</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${formatBRL(pricing.minBRL)} – ${formatBRL(pricing.maxBRL)}</td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:12px;color:#6b7280">* Valor final definido após reunião de discovery, dentro da faixa indicada.</p>
</div>

</body>
</html>`;

    const summaryBullets = [
        `Empresa: ${assessment.company} — Responsável: ${assessment.name}`,
        `Escopo: ${modules.length} módulo(s) — ${modules.map((m: any) => m.title).join(", ")}`,
        `Prazo estimado: ${totalWeeks} semanas a partir do kickoff`,
        `Investimento: ${formatBRL(pricing.minBRL)} – ${formatBRL(pricing.maxBRL)}`,
        `Cancelamento sem custo em até 7 dias (antes do início)`,
        `Aceite eletrônico válido conforme MP 2.200-2/2001`,
    ];

    return { publicSlug, htmlBody, summaryBullets };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeJsonParse(s: string, fallback: any): any {
    try { return JSON.parse(s); } catch { return fallback; }
}

function formatBRL(n: number): string {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}
