/**
 * lib/dealflow/dealflow-engine.ts
 * V21 Prompt 3/4: Deal Flow Engine — Hot Lead Autopilot + Anti-Commodity.
 *
 * Functions:
 *  1) classifyTier(assessment, roiProjection, proposal?)
 *  2) buildExecOnePager(assessment, roiProjection, proofStats, tier)
 *     – deterministic HTML, ZERO LLM, NO technical blueprint
 *  3) createDealPacket(orgId, assessmentId)
 *     – assembles and persists the deal packet
 *
 * Anti-Commodity principle:
 *  – Executive One-Pager (public/client): results, ROI, roadmap — no stack, no blueprint
 *  – Architecture Plan (admin only): modules, integrations, tasks
 */

import { createHash } from "crypto";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/runtime/base-url";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Tier = "hot" | "warm" | "cold";

export interface TierResult {
    tier: Tier;
    reason: string;
}

export interface ExecOnePagerData {
    companyName: string;
    segment: string;
    teamSize: string;
    problemSummary: string;
    impactMetrics: Array<{ label: string; value: string }>;
    roadmapPhases: Array<{ phase: string; title: string; description: string }>;
    urgencyReason: string;
    ctaUrl: string;
    whatsappUrl: string;
    tier: Tier;
}

// ─── 1. classifyTier ─────────────────────────────────────────────────────────

export function classifyTier(
    assessment: { scoreTotal: number; urgency: string; classification?: string },
    roiProjection: { estimatedPaybackMonths: number; confidenceLevel: string } | null,
    _proposal?: any,
): TierResult {
    const score = assessment.scoreTotal ?? 0;
    const payback = roiProjection?.estimatedPaybackMonths ?? 99;
    const confHigh = roiProjection?.confidenceLevel?.toLowerCase() === "alta";

    if (score >= 80 || payback <= 1.0 || confHigh) {
        const reason = score >= 80
            ? `Score ${score}/100`
            : payback <= 1.0
                ? `Payback ${payback} mês`
                : "Confiança alta no ROI";
        return { tier: "hot", reason };
    }

    if (score >= 50) {
        return { tier: "warm", reason: `Score ${score}/100` };
    }

    return { tier: "cold", reason: `Score ${score}/100` };
}

// ─── 2. buildExecOnePager ─────────────────────────────────────────────────────

export function buildExecOnePager(data: ExecOnePagerData): string {
    const { companyName, segment, teamSize, problemSummary, impactMetrics,
        roadmapPhases, urgencyReason, ctaUrl, whatsappUrl, tier } = data;

    const tierGradient = tier === "hot"
        ? "from-orange-600 to-red-600"
        : tier === "warm"
            ? "from-amber-500 to-orange-500"
            : "from-blue-600 to-indigo-600";

    const tierLabel = tier === "hot" ? "🔥 Prioridade Máxima" : tier === "warm" ? "⚡ Alta Relevância" : "Análise Estratégica";

    const metricsHtml = impactMetrics.map(m => `
        <div class="metric-card">
            <div class="metric-value">${m.value}</div>
            <div class="metric-label">${m.label}</div>
        </div>`).join("");

    const roadmapHtml = roadmapPhases.map((p, i) => `
        <div class="phase">
            <div class="phase-number">${i + 1}</div>
            <div class="phase-content">
                <div class="phase-tag">${p.phase}</div>
                <div class="phase-title">${p.title}</div>
                <div class="phase-desc">${p.description}</div>
            </div>
        </div>`).join("");

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Análise Estratégica — ${companyName}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#0a0a0f;color:#e8e8f0;min-height:100vh}
  .container{max-width:860px;margin:0 auto;padding:48px 24px}
  .badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;margin-bottom:32px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07)}
  .header-company{font-size:13px;color:#6b7280;font-weight:500;margin-bottom:12px}
  h1{font-size:clamp(28px,5vw,44px);font-weight:800;line-height:1.15;background:linear-gradient(135deg,#fff 0%,#c9d1e0 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:24px}
  .problem{font-size:17px;color:#9ca3af;line-height:1.7;margin-bottom:48px;max-width:680px;padding:24px;background:rgba(255,255,255,.03);border-left:3px solid rgba(99,102,241,.5);border-radius:0 8px 8px 0}
  .section-title{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6366f1;margin-bottom:20px}
  .metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:48px}
  .metric-card{background:linear-gradient(135deg,rgba(99,102,241,.1) 0%,rgba(139,92,246,.05) 100%);border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:24px;text-align:center}
  .metric-value{font-size:32px;font-weight:800;color:#a5b4fc;margin-bottom:6px}
  .metric-label{font-size:13px;color:#6b7280;font-weight:500}
  .roadmap{margin-bottom:48px}
  .phase{display:flex;gap:20px;margin-bottom:24px;align-items:flex-start}
  .phase-number{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0;color:#fff}
  .phase-content{flex:1;padding-top:4px}
  .phase-tag{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b5cf6;margin-bottom:4px}
  .phase-title{font-size:17px;font-weight:700;color:#e8e8f0;margin-bottom:6px}
  .phase-desc{font-size:14px;color:#9ca3af;line-height:1.6}
  .urgency-box{background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:20px 24px;margin-bottom:40px;display:flex;gap:12px;align-items:flex-start}
  .urgency-icon{font-size:20px;flex-shrink:0}
  .urgency-text{font-size:14px;color:#fbbf24;line-height:1.6}
  .cta-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:48px}
  .btn-primary{display:inline-flex;align-items:center;gap:8px;padding:16px 32px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;transition:opacity .2s}
  .btn-secondary{display:inline-flex;align-items:center;gap:8px;padding:16px 32px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#e8e8f0;transition:background .2s}
  .footer{border-top:1px solid rgba(255,255,255,.07);padding-top:24px;text-align:center;font-size:12px;color:#374151}
  .footer b{color:#6b7280}
  @media(max-width:600px){.cta-row{flex-direction:column}.btn-primary,.btn-secondary{justify-content:center}}
</style>
</head>
<body>
<div class="container">
  <div class="badge">
    <span style="width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,${tierGradient.replace("from-", "").replace(/ to-.*$/, "")},${tierGradient.replace(/.*to-/, "")})" ></span>
    ${tierLabel}
  </div>

  <div class="header-company">${companyName} · ${segment} · ${teamSize}</div>
  <h1>Análise de Potencial de Automação</h1>

  <div class="problem">
    ${problemSummary}
  </div>

  <div class="section-title">Projeção de Impacto</div>
  <div class="metrics-grid">
    ${metricsHtml}
  </div>

  <div class="section-title">Roadmap — 30 Dias</div>
  <div class="roadmap">
    ${roadmapHtml}
  </div>

  <div class="urgency-box">
    <span class="urgency-icon">⚡</span>
    <span class="urgency-text">${urgencyReason}</span>
  </div>

  <div class="section-title">Próximo passo</div>
  <div class="cta-row">
    <a href="${ctaUrl}" class="btn-primary" onclick="fetch('/api/public/deal/${data.tier}/cta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:window.location.pathname.split('/').pop()})})">
      📅 Agendar Diagnóstico Gratuito
    </a>
    <a href="${whatsappUrl}" target="_blank" class="btn-secondary">
      💬 Falar no WhatsApp
    </a>
  </div>

  <div class="footer">
    Documento preparado exclusivamente para <b>${companyName}</b>.<br>
    Projeções baseadas em análise diagnóstica. InovaCortex © ${new Date().getFullYear()}
  </div>
</div>
</body>
</html>`;
}

// ─── Exec One-Pager data builder ──────────────────────────────────────────────

export function buildExecOnePagerData(
    assessment: {
        company: string; segment: string; teamSize: string; urgency: string;
        pains: string; goal: string; channels: string;
    },
    roiProjection: {
        operationalSavingsEstimate: number; revenueIncreaseEstimate: number;
        monthlyHoursRecovered: number; estimatedPaybackMonths: number;
    } | null,
    proofStats: {
        totalCases: number; avgPaybackMonths: number; avgMonthlyEconomy: number;
    } | null,
    tier: Tier,
    baseUrl: string,
): ExecOnePagerData {
    const pains: string[] = (() => { try { return JSON.parse(assessment.pains); } catch { return []; } })();
    const channels: string[] = (() => { try { return JSON.parse(assessment.channels); } catch { return []; } })();

    const economy = roiProjection?.operationalSavingsEstimate ?? 0;
    const revenue = roiProjection?.revenueIncreaseEstimate ?? 0;
    const hours = roiProjection?.monthlyHoursRecovered ?? 0;
    const payback = roiProjection?.estimatedPaybackMonths ?? 0;

    const problemSummary = pains.length > 0
        ? `${assessment.company} enfrenta desafios operacionais relacionados a: ${pains.slice(0, 2).join(" e ")}. Com ${assessment.teamSize} de equipe e alto volume de operações nos canais de ${channels.slice(0, 2).join(", ")}, existe um potencial significativo de automação inteligente que pode transformar resultados nos próximos 30 dias.`
        : `${assessment.company} opera no segmento de ${assessment.segment} e apresenta potencial expressivo para automação de processos operacionais e comerciais, com ganhos projetados em curto prazo.`;

    const impactMetrics = [
        economy > 0 ? { label: "Economia operacional/mês", value: formatCurrency(economy) } : null,
        revenue > 0 ? { label: "Receita adicional estimada/mês", value: formatCurrency(revenue) } : null,
        hours > 0 ? { label: "Horas recuperadas/mês", value: `${Math.round(hours)}h` } : null,
        payback > 0 ? { label: "Payback estimado", value: `${payback} meses` } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    // Ensure at least 3 metrics
    if (impactMetrics.length < 3) {
        impactMetrics.push({ label: "Capacidade de atendimento", value: "+40%" });
        if (proofStats?.totalCases) {
            impactMetrics.push({ label: "Casos similares implementados", value: `${proofStats.totalCases}+` });
        }
    }

    const roadmapPhases = [
        {
            phase: "Semana 1–2",
            title: "Diagnóstico & Arquitetura",
            description: "Mapeamento dos processos-alvo, definição da arquitetura de automação e configuração dos ambientes.",
        },
        {
            phase: "Semana 2–3",
            title: "Implementação & Integração",
            description: "Desenvolvimento dos fluxos automatizados, integrações com sistemas atuais e testes com dados reais.",
        },
        {
            phase: "Semana 4",
            title: "Go-Live & Monitoramento",
            description: "Ativação em produção, treinamento do time e acompanhamento de métricas na primeira semana de operação.",
        },
    ];

    const urgencyReasons: string[] = [];
    const urg = assessment.urgency.toLowerCase();
    if (urg.includes("alta") || urg.includes("imediato")) {
        urgencyReasons.push("Urgência alta identificada no diagnóstico — cada semana sem automação representa custo operacional evitável.");
    } else {
        urgencyReasons.push("Empresas do segmento que automatizaram nos últimos 12 meses reportam vantagem competitiva crescente. Quanto mais cedo se inicia, maior o ROI acumulado.");
    }
    if (proofStats?.avgPaybackMonths && proofStats.avgPaybackMonths < 6) {
        urgencyReasons.push(`Média de payback dos nossos clientes: ${proofStats.avgPaybackMonths} meses.`);
    }

    const waNumber = process.env.WHATSAPP_NUMBER ?? "5511999999999";
    const waMsg = encodeURIComponent(`Olá! Acabei de ver a análise estratégica para ${assessment.company}. Tenho interesse em agendar o diagnóstico.`);

    return {
        companyName: assessment.company,
        segment: assessment.segment,
        teamSize: assessment.teamSize,
        problemSummary,
        impactMetrics: impactMetrics.slice(0, 4),
        roadmapPhases,
        urgencyReason: urgencyReasons.join(" "),
        ctaUrl: `${baseUrl}/contato`,
        whatsappUrl: `https://wa.me/${waNumber}?text=${waMsg}`,
        tier,
    };
}

// ─── 3. createDealPacket ──────────────────────────────────────────────────────

export async function createDealPacket(
    orgId: string,
    assessmentId: string,
    proposalId?: string,
): Promise<{ dealPacketId: string; execSlug: string; tier: Tier }> {
    const { prisma } = await import("@/lib/prisma");

    // Load assessment
    const assessment = await (prisma as any).assessment.findUnique({
        where: { id: assessmentId },
    });
    if (!assessment) throw new Error(`Assessment not found: ${assessmentId}`);

    // Load ROI projection
    const roiProjection = await (prisma as any).roiProjection.findUnique({
        where: { assessmentId },
    }).catch(() => null);

    // Load proposal if provided
    const proposal = proposalId
        ? await (prisma as any).proposal.findUnique({ where: { id: proposalId } }).catch(() => null)
        : null;

    // Load proof stats
    const proofStats = await (prisma as any).proofStatSnapshot.findUnique({
        where: { orgId },
    }).catch(() => null);

    // Classify tier
    const { tier } = classifyTier(assessment, roiProjection, proposal);

    // Build slug (sha1 of orgId+assessmentId, first 12 chars)
    const version = Date.now().toString();
    const execSlug = createHash("sha1")
        .update(`${orgId}:${assessmentId}:${version}`)
        .digest("hex")
        .slice(0, 12);

    const baseUrl = getBaseUrl();

    // Build one-pager data
    const onePagerData = buildExecOnePagerData(assessment, roiProjection, proofStats, tier, baseUrl);
    const execOnePagerHtml = buildExecOnePager(onePagerData);

    // Upsert DealPacket (idempotent: update if already exists for same assessmentId)
    const existing = await (prisma as any).dealPacket.findFirst({
        where: { orgId, assessmentId },
        orderBy: { createdAt: "desc" },
    }).catch(() => null);

    let dealPacket;
    if (existing && existing.status === "draft") {
        dealPacket = await (prisma as any).dealPacket.update({
            where: { id: existing.id },
            data: { tier, execOnePagerHtml, proposalId: proposalId ?? existing.proposalId },
        });
    } else {
        dealPacket = await (prisma as any).dealPacket.create({
            data: {
                orgId, assessmentId, proposalId: proposalId ?? null,
                tier, status: "draft",
                execOnePagerHtml, execSlug,
            },
        });
    }

    logger.info("[DealFlow] createDealPacket done", {
        orgId, assessmentId, tier, execSlug: dealPacket.execSlug,
    });

    return { dealPacketId: dealPacket.id, execSlug: dealPacket.execSlug, tier };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatCurrency(v: number): string {
    if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace(".", ",")}k`;
    return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}
