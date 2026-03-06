import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateROI } from "@/lib/roi-engine";
import puppeteer from "puppeteer";

export const runtime = "nodejs";
export const maxDuration = 60;

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // 1. Fetch data from DB
    const report = await prisma.artifactReport.findUnique({
      where: { publicSlug: slug },
      include: { assessment: true },
    });

    if (!report) {
      return new NextResponse("Dossiê não encontrado", { status: 404 });
    }

    // 2. Audit log
    if (report.assessmentId) {
      await prisma.auditEvent.create({
        data: {
          assessmentId: report.assessmentId,
          action: "pdfGenerated",
          details: JSON.stringify({ triggeredFrom: "download" }),
        },
      });
    }

    const assessment = report.assessment;
    const content = JSON.parse(report.contentJson);

    // 3. ROI calculation
    const roiRow = await (prisma as any).roiProjection.findUnique({
      where: { assessmentId: assessment.id },
    });
    const roi = calculateROI({
      teamSize: assessment.teamSize,
      volumeDay: assessment.volumeDay,
      scoreTotal: assessment.scoreTotal,
      classification: assessment.classification,
      pains: JSON.parse(assessment.pains || "[]"),
      ...(roiRow
        ? {
          avgHourlyCost: roiRow.avgHourlyCost ?? undefined,
          avgTicket: roiRow.avgTicket ?? undefined,
          conversionRate: roiRow.conversionRate ?? undefined,
        }
        : {}),
    });

    const createdAt = new Date(assessment.createdAt).toLocaleDateString("pt-BR");
    const shortHash = slug.substring(0, 8);
    const missions: string[] = JSON.parse(assessment.recommendedMissions);
    const modules: string[] = content.blueprint?.modules ?? [];
    const integrations: string[] = content.blueprint?.integrations ?? [];
    const roadmap: { phase: string; title: string; description: string }[] =
      content.roadmap ?? [];
    const risks: string[] = content.risks ?? [];

    // 4. Build self-contained HTML (no external network calls needed by Puppeteer)
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Dossiê de Diagnóstico — ${assessment.company}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: #0a0a0a;
    color: #e5e5e5;
    font-size: 13px;
    line-height: 1.6;
  }
  .page { max-width: 780px; margin: 0 auto; padding: 32px 28px 48px; }

  /* Header */
  .header { background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%); border-bottom: 1px solid #2a2a3e; padding: 40px 28px 32px; margin: -32px -28px 40px; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .brand-icon { width: 32px; height: 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
  .brand-name { font-size: 18px; font-weight: 800; letter-spacing: -0.5px; color: #fff; }
  h1 { font-size: 30px; font-weight: 900; letter-spacing: -0.5px; color: #fff; margin-bottom: 8px; }
  .subtitle { font-size: 16px; color: #a1a1aa; margin-bottom: 24px; }
  .subtitle strong { color: #e4e4f0; }
  .meta { display: flex; gap: 24px; font-size: 12px; color: #71717a; }
  .meta span { display: flex; align-items: center; gap: 6px; }

  /* Section titles */
  h2 { font-size: 17px; font-weight: 800; color: #fff; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #2a2a3e; display: flex; align-items: center; gap: 8px; }
  h2 .icon { width: 20px; height: 20px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
  h3 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; margin-bottom: 10px; }
  section { margin-bottom: 36px; }

  /* Score + Missions grid */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px; position: relative; overflow: hidden; }
  .card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #6366f1, #8b5cf6); }
  .score { font-size: 56px; font-weight: 900; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1; }
  .score-denom { font-size: 22px; color: #52525b; font-weight: 700; margin-left: 2px; }
  .classification { font-size: 15px; font-weight: 700; color: #e4e4f0; margin-top: 10px; }
  .desc { font-size: 11px; color: #71717a; margin-top: 6px; }
  .mission-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .mission-item { display: flex; align-items: flex-start; gap: 8px; }
  .check { width: 16px; height: 16px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #fff; flex-shrink: 0; margin-top: 1px; }

  /* ROI Cards */
  .roi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .roi-card { background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 16px; }
  .roi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; margin-bottom: 4px; }
  .roi-value { font-size: 22px; font-weight: 800; color: #6366f1; }
  .roi-sub { font-size: 11px; color: #52525b; margin-top: 2px; }

  /* Blueprint */
  .blueprint-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .bp-card { background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 16px; }
  .bp-title { font-size: 12px; font-weight: 700; color: #e4e4f0; margin-bottom: 10px; }
  .bp-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .bp-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #a1a1aa; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }
  .dot.accent { background: #8b5cf6; }

  /* Roadmap */
  .roadmap-list { display: flex; flex-direction: column; gap: 12px; }
  .roadmap-item { display: flex; align-items: flex-start; gap: 12px; background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 14px; }
  .phase-badge { background: rgba(99, 102, 241, 0.15); color: #818cf8; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 6px; white-space: nowrap; flex-shrink: 0; border: 1px solid rgba(99,102,241,0.3); }
  .roadmap-title { font-size: 13px; font-weight: 700; color: #e4e4f0; }
  .roadmap-desc { font-size: 11px; color: #71717a; margin-top: 3px; }

  /* Risks */
  .risks-section { background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; padding: 20px; }
  .risk-title { color: #f87171; margin-bottom: 14px; }
  .risk-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .risk-item { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; font-weight: 500; color: #d1d5db; }
  .risk-dot { color: #f87171; flex-shrink: 0; margin-top: 2px; }

  /* Footer */
  .footer { text-align: center; margin-top: 48px; padding-top: 20px; border-top: 1px solid #1f2937; }
  .footer p { font-size: 11px; color: #52525b; }
  .footer strong { color: #6366f1; }
  .confidence-badge { display: inline-block; background: rgba(99, 102, 241, 0.15); color: #818cf8; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 20px; border: 1px solid rgba(99,102,241,0.3); margin-top: 8px; }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <header class="header">
    <div class="brand">
      <div class="brand-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/></svg>
      </div>
      <span class="brand-name">InovaCortex</span>
    </div>
    <h1>Dossiê de Diagnóstico Técnico</h1>
    <p class="subtitle">Análise de Infraestrutura para <strong>${assessment.company}</strong></p>
    <div class="meta">
      <span>📅 Gerado em: ${createdAt}</span>
      <span>🔒 Hash: ${shortHash}</span>
    </div>
  </header>

  <!-- SCORE + MISSIONS -->
  <section>
    <div class="grid-2">
      <div class="card">
        <h3>Potencial de Automação</h3>
        <div style="display:flex;align-items:flex-end;gap:4px; margin-top:8px;">
          <span class="score">${assessment.scoreTotal}</span>
          <span class="score-denom">/100</span>
        </div>
        <p class="classification">${assessment.classification}</p>
        <p class="desc">Esta pontuação reflete a viabilidade arquitetural e o impacto financeiro de implementar IA na operação atual.</p>
      </div>
      <div class="card">
        <h3>Foco Inicial (Missões)</h3>
        <ul class="mission-list" style="margin-top:8px;">
          ${missions.map((m) => `<li class="mission-item"><div class="check">✓</div><span>${m}</span></li>`).join("")}
        </ul>
      </div>
    </div>
  </section>

  <!-- ROI -->
  <section>
    <h2><span class="icon">💰</span> Impacto Financeiro Estimado</h2>
    <div class="roi-grid">
      <div class="roi-card">
        <div class="roi-label">Economia Operacional/mês</div>
        <div class="roi-value">${formatBRL(roi.operationalSavingsEstimate)}</div>
        <div class="roi-sub">Faixa: ${roi.savingsRange}</div>
      </div>
      <div class="roi-card">
        <div class="roi-label">Aumento de Receita/mês</div>
        <div class="roi-value">${formatBRL(roi.revenueIncreaseEstimate)}</div>
        <div class="roi-sub">Faixa: ${roi.revenueRange}</div>
      </div>
      <div class="roi-card">
        <div class="roi-label">Horas Recuperadas/mês</div>
        <div class="roi-value">${roi.monthlyHoursRecovered}h</div>
        <div class="roi-sub">Faixa: ${roi.hoursRange}</div>
      </div>
      <div class="roi-card">
        <div class="roi-label">Payback Estimado</div>
        <div class="roi-value">${roi.estimatedPaybackMonths} meses</div>
        <div class="roi-sub">Confiança: ${roi.confidenceLevel}</div>
      </div>
    </div>
  </section>

  <!-- BLUEPRINT -->
  <section>
    <h2><span class="icon">⚡</span> Blueprint da Solução Recomendada</h2>
    <div class="blueprint-grid">
      <div class="bp-card">
        <p class="bp-title">Módulos Inteligentes</p>
        <ul class="bp-list">
          ${modules.map((m) => `<li class="bp-item"><div class="dot"></div>${m}</li>`).join("")}
        </ul>
      </div>
      <div class="bp-card">
        <p class="bp-title">Conexões Mapeadas</p>
        <ul class="bp-list">
          ${integrations.map((i) => `<li class="bp-item"><div class="dot accent"></div>${i}</li>`).join("")}
        </ul>
      </div>
    </div>
  </section>

  <!-- ROADMAP -->
  <section>
    <h2><span class="icon">📋</span> Roadmap Tático (30 Dias)</h2>
    <div class="roadmap-list">
      ${roadmap
        .map(
          (step) => `<div class="roadmap-item">
        <span class="phase-badge">${step.phase}</span>
        <div>
          <div class="roadmap-title">${step.title}</div>
          <div class="roadmap-desc">${step.description}</div>
        </div>
      </div>`
        )
        .join("")}
    </div>
  </section>

  <!-- RISKS -->
  <section class="risks-section">
    <h2 class="risk-title"><span>⚠️</span> Fatores de Risco Operacional</h2>
    <p style="font-size:12px;color:#9ca3af;margin-bottom:14px;">Identificamos os seguintes pontos de atenção para garantir o sucesso do projeto:</p>
    <ul class="risk-list">
      ${risks.map((r) => `<li class="risk-item"><span class="risk-dot">•</span> ${r}</li>`).join("")}
    </ul>
  </section>

  <!-- FOOTER -->
  <div class="footer">
    <p>Dossiê Gerado Oficialmente pela <strong>InovaCortex</strong></p>
    <p style="margin-top:4px;">Agende sua consultoria: <strong>wa.me/5511967011133</strong></p>
    <span class="confidence-badge">Índice de Confiança: ${roi.confidenceLevel}</span>
    <p style="margin-top:12px;font-size:10px;color:#3f3f46;">* As projeções financeiras são estimativas baseadas em dados históricos de projetos similares e não constituem garantia de resultados.</p>
  </div>

</div>
</body>
</html>`;

    // 5. Launch Puppeteer with the HTML content (no network call back to Next.js)
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // Feed HTML directly — no HTTP request back to Next.js server
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
    });

    // Wait for Google Fonts to potentially load (with a short timeout fallback)
    await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {
      // Timeout is fine — embedded fonts are optional, fallbacks work
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "15mm",
        bottom: "15mm",
        left: "12mm",
        right: "12mm",
      },
    });

    await browser.close();

    // --- VERCEL SERVERLESS COMPATIBILITY CHECK ---
    // Puppeteer exceeds Vercel limits (50MB function size, 10s-15s timeouts).
    // In production, this should be offloaded to an AWS Lambda or dedicated service.
    if (process.env.VERCEL === "1") {
      return new NextResponse(
        "PDF generation is temporarily disabled in Vercel Serverless environment due to Chromium binary size limits. Please implement a dedicated background worker or use @sparticuz/chromium.",
        { status: 501 }
      );
    }

    const safeCompany = assessment.company.replace(/[^a-z0-9]/gi, "_");

    // Wrap in a Blob to satisfy Next.js BodyInit strict typing
    const blob = new Blob([pdfBuffer as unknown as ArrayBuffer], { type: "application/pdf" });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="InovaCortex_Dossie_${safeCompany}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[PDF Generation Error]:", error);
    return new NextResponse(
      `Erro ao gerar PDF: ${error instanceof Error ? error.message : String(error)}`,
      { status: 500 }
    );
  }
}
