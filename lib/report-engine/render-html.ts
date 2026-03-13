import { readFile } from "fs/promises";
import path from "path";
import { AutomationScoreTemplate } from "@/lib/report-engine/templates/automation-score";
import { CoverTemplate } from "@/lib/report-engine/templates/cover";
import { ExecutiveSummaryTemplate } from "@/lib/report-engine/templates/executive-summary";
import { FinancialImpactTemplate } from "@/lib/report-engine/templates/financial-impact";
import { RoadmapTemplate } from "@/lib/report-engine/templates/roadmap";
import type { NormalizedBusinessMRIReportData } from "@/lib/report-engine/types";

type ChartPayload = {
    score: number;
    financial: {
        savings: number;
        revenue: number;
        hours: number;
    };
    efficiencySeries: number[];
};

let chartLibraryCache: Promise<string> | null = null;

export async function renderBusinessMRIHtml(data: NormalizedBusinessMRIReportData): Promise<string> {
    const pages = [
        CoverTemplate({ data }),
        ExecutiveSummaryTemplate({ data }),
        AutomationScoreTemplate({ data }),
        FinancialImpactTemplate({ data }),
        buildHeatmapPage(data),
        buildArchitecturePage(data),
        RoadmapTemplate({ data }),
        buildRisksPage(data),
        buildNextStepsPage(data),
    ];

    const chartPayload = buildChartPayload(data);
    const chartLibrary = await loadChartLibraryScript();
    const chartLibraryTag = chartLibrary
        ? `<script>${escapeScriptTag(chartLibrary)}</script>`
        : `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>InovaCortex AI Business MRI - ${escapeHtml(data.companyName)}</title>
  <style>
    :root {
      --report-bg: #ffffff;
      --report-text: #0f172a;
      --report-muted: #475569;
      --report-gold: #b88a2a;
      --report-gold-soft: #f4ead4;
      --report-border: #d8dbe1;
      --report-panel: #f8fafc;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--report-bg); color: var(--report-text); }
    body {
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    .page {
      width: 100%;
      min-height: 256mm;
      padding: 10mm 0 8mm;
      position: relative;
      background: var(--report-bg);
      page-break-after: always;
      break-after: page;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .page-cover {
      background:
        radial-gradient(circle at 18% 8%, rgba(184,138,42,0.22), transparent 42%),
        linear-gradient(180deg, #0a0a0a 0%, #111827 72%, #181818 100%);
      color: #f8fafc;
    }
    .cover-topline {
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-size: 10px;
      color: #e6c983;
      font-weight: 700;
      margin-bottom: 22px;
    }
    .page-cover h1 {
      margin: 0 0 12px;
      font-size: 38px;
      line-height: 1.1;
      max-width: 82%;
    }
    .cover-subtitle {
      margin: 0 0 28px;
      max-width: 72%;
      color: #d7dce7;
      font-size: 15px;
    }
    .cover-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 14px;
      max-width: 82%;
    }
    .cover-card {
      border: 1px solid rgba(230, 201, 131, 0.45);
      background: rgba(17, 24, 39, 0.68);
      border-radius: 10px;
      padding: 11px;
    }
    .cover-card h2 {
      margin: 0 0 5px;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #f1ddb0;
    }
    .cover-highlight {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #ffffff;
    }
    .cover-footer {
      position: absolute;
      bottom: 10mm;
      left: 0;
      right: 0;
      color: #d7dce7;
      font-size: 11px;
      border-top: 1px solid rgba(230, 201, 131, 0.4);
      padding-top: 10px;
    }
    .section-header {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 14px;
      border-bottom: 2px solid var(--report-gold);
      padding-bottom: 8px;
    }
    .section-kicker {
      color: var(--report-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 10px;
      font-weight: 700;
    }
    h2 {
      margin: 0;
      font-size: 27px;
      line-height: 1.15;
      color: #111827;
    }
    h3 {
      margin: 0 0 8px;
      font-size: 15px;
      color: #111827;
    }
    .summary-block {
      background: var(--report-panel);
      border: 1px solid var(--report-border);
      border-left: 4px solid var(--report-gold);
      border-radius: 10px;
      padding: 13px;
      margin-bottom: 12px;
      font-size: 14px;
      color: #1f2937;
    }
    .two-col {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 12px;
    }
    .panel {
      border: 1px solid var(--report-border);
      border-radius: 10px;
      padding: 11px;
      background: #fff;
    }
    .bullet-list {
      margin: 0;
      padding-left: 18px;
      font-size: 13px;
      color: #334155;
    }
    .bullet-list li { margin-bottom: 6px; }
    .quote-block {
      border: 1px dashed #bfa05e;
      background: var(--report-gold-soft);
      border-radius: 10px;
      padding: 12px;
      font-size: 13px;
      color: #3f2d0e;
    }
    .score-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 12px;
    }
    .score-card,
    .kpi-card {
      border: 1px solid var(--report-border);
      border-radius: 10px;
      background: #fff;
      padding: 12px;
    }
    .metric-label {
      margin: 0 0 6px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      font-size: 11px;
      color: var(--report-muted);
    }
    .metric-value {
      margin: 0;
      font-size: 30px;
      line-height: 1.1;
      font-weight: 700;
      color: #0f172a;
    }
    .metric-value.small { font-size: 21px; }
    .metric-caption {
      margin: 7px 0 0;
      font-size: 12px;
      color: #64748b;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 12px;
    }
    .chart-panel {
      border: 1px solid var(--report-border);
      border-radius: 10px;
      background: #fff;
      padding: 10px;
    }
    .chart-panel canvas {
      display: block;
      width: 100% !important;
      height: 285px !important;
    }
    .heatmap-table,
    .roadmap-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--report-border);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 12px;
      font-size: 12px;
    }
    .heatmap-table th,
    .heatmap-table td,
    .roadmap-table th,
    .roadmap-table td {
      padding: 8px 7px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
      vertical-align: top;
    }
    .heatmap-table th,
    .roadmap-table th {
      background: #0f172a;
      color: #f8fafc;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .impact-high { color: #8a6b1f; font-weight: 700; }
    .impact-medium { color: #334155; font-weight: 700; }
    .impact-low { color: #64748b; }
    .blueprint-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 10px;
    }
    .note-list {
      margin: 0;
      padding-left: 18px;
      color: #334155;
      font-size: 13px;
    }
    .risks-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .risk-card {
      border: 1px solid var(--report-border);
      border-left: 4px solid var(--report-gold);
      border-radius: 10px;
      background: #fff;
      padding: 10px;
      min-height: 88px;
      font-size: 13px;
      color: #1f2937;
    }
    .next-steps {
      margin: 0;
      padding-left: 20px;
      font-size: 13px;
      color: #334155;
      display: grid;
      gap: 8px;
    }
    .cta-banner {
      margin-top: 14px;
      border-radius: 12px;
      border: 1px solid #b88a2a;
      background: #111827;
      color: #f8fafc;
      padding: 14px;
    }
    .cta-banner strong {
      display: block;
      margin-bottom: 6px;
      color: #f1ddb0;
      font-size: 14px;
    }
  </style>
  ${chartLibraryTag}
</head>
<body>
  ${pages.join("\n")}
  <script>
    ${buildChartBootstrapScript(chartPayload)}
  </script>
</body>
</html>`;
}

function buildChartPayload(data: NormalizedBusinessMRIReportData): ChartPayload {
    const score = clamp(data.scoreTotal, 0, 100);
    const efficiencySeries = [
        Math.max(15, Math.round(score * 0.35)),
        Math.max(20, Math.round(score * 0.52)),
        Math.max(30, Math.round(score * 0.68)),
        Math.max(40, Math.round(score * 0.82)),
    ];

    return {
        score,
        financial: {
            savings: safeNumber(data.roi.operationalSavingsEstimate),
            revenue: safeNumber(data.roi.revenueIncreaseEstimate),
            hours: safeNumber(data.roi.monthlyHoursRecovered),
        },
        efficiencySeries,
    };
}

function buildHeatmapPage(data: NormalizedBusinessMRIReportData): string {
    const pains = nonEmptyOrFallback(data.pains, ["Gargalos operacionais nao detalhados"]);
    const missions = nonEmptyOrFallback(data.recommendedMissions, [
        "Padronizacao de atendimento",
        "Automacao de follow-up",
        "Painel de gestao de performance",
    ]).slice(0, 3);

    const rows = pains.slice(0, 6).map((pain, painIdx) => {
        const cells = missions.map((_mission, missionIdx) => {
            const score = (painIdx + 2) * (missionIdx + 3);
            const level = score % 3 === 0 ? "Alto" : score % 2 === 0 ? "Medio" : "Baixo";
            const levelClass = level === "Alto" ? "impact-high" : level === "Medio" ? "impact-medium" : "impact-low";
            return `<td class="${levelClass}">${level}</td>`;
        });
        return `<tr><td>${escapeHtml(pain)}</td>${cells.join("")}</tr>`;
    });

    return `<section class="page">
      <header class="section-header">
        <span class="section-kicker">Pagina 5</span>
        <h2>Automation Heatmap</h2>
      </header>
      <table class="heatmap-table">
        <thead>
          <tr>
            <th>Processo / Dor</th>
            <th>${escapeHtml(missions[0] ?? "Missao A")}</th>
            <th>${escapeHtml(missions[1] ?? "Missao B")}</th>
            <th>${escapeHtml(missions[2] ?? "Missao C")}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join("")}
        </tbody>
      </table>
      <article class="summary-block">
        <p>
          A matriz mostra os pontos com maior efeito em eficiencia e caixa. Priorize as celulas
          de impacto alto nas primeiras sprints de implementacao.
        </p>
      </article>
    </section>`;
}

function buildArchitecturePage(data: NormalizedBusinessMRIReportData): string {
    const modules = nonEmptyOrFallback(data.blueprint.modules, ["Core CRM", "Ops Dashboard", "Workflow Orchestration"]);
    const integrations = nonEmptyOrFallback(data.blueprint.integrations, [
        "WhatsApp API",
        "Calendario comercial",
        "ERP / financeiro",
    ]);
    const notes = nonEmptyOrFallback(data.blueprint.architectureNotes ?? [], [
        "Padronizar eventos entre vendas, atendimento e operacoes para rastreabilidade.",
        "Aplicar camadas de permissao por tenant e trilha de auditoria para cada acao.",
        "Monitorar SLAs com alarmes proativos e failover operacional.",
    ]);

    return `<section class="page">
      <header class="section-header">
        <span class="section-kicker">Pagina 6</span>
        <h2>Architecture Blueprint</h2>
      </header>
      <div class="blueprint-grid">
        <article class="panel">
          <h3>Modulos recomendados</h3>
          <ul class="bullet-list">${modules.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </article>
        <article class="panel">
          <h3>Integracoes criticas</h3>
          <ul class="bullet-list">${integrations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </article>
      </div>
      <article class="panel">
        <h3>Diretrizes de arquitetura e governanca</h3>
        <ul class="note-list">${notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>
    </section>`;
}

function buildRisksPage(data: NormalizedBusinessMRIReportData): string {
    const risks = nonEmptyOrFallback(data.risks, [
        "Resistencia a adocao pelas equipes operacionais.",
        "Dados inconsistentes entre sistemas legados.",
        "Ausencia de rotina de acompanhamento semanal.",
        "Dependencia de processos manuais sem redundancia.",
    ]).slice(0, 8);

    return `<section class="page">
      <header class="section-header">
        <span class="section-kicker">Pagina 8</span>
        <h2>Operational Risks</h2>
      </header>
      <div class="risks-grid">
        ${risks
            .map(
                (risk) => `<article class="risk-card">
              <h3>Risco mapeado</h3>
              <p>${escapeHtml(risk)}</p>
            </article>`
            )
            .join("")}
      </div>
      <article class="summary-block">
        <p>
          Cada risco deve ter owner, indicador de alerta e plano de contingencia definidos antes do go-live.
        </p>
      </article>
    </section>`;
}

function buildNextStepsPage(data: NormalizedBusinessMRIReportData): string {
    const monthlyBenefit = safeNumber(data.roi.operationalSavingsEstimate) + safeNumber(data.roi.revenueIncreaseEstimate);
    return `<section class="page">
      <header class="section-header">
        <span class="section-kicker">Pagina 9</span>
        <h2>Next Steps</h2>
      </header>
      <ol class="next-steps">
        <li>Validar com os decisores o escopo da fase 1 e o baseline dos KPIs em ate 48 horas.</li>
        <li>Definir squad responsavel por implantacao com ritos semanais e check de risco.</li>
        <li>Executar sprint de 30 dias com foco em ganhos de caixa e reducao de retrabalho.</li>
        <li>Revisar resultados com comite executivo e aprovar fase de escala.</li>
      </ol>
      <article class="cta-banner">
        <strong>Potencial economico estimado</strong>
        Resultado mensal combinado projetado: ${formatCurrency(monthlyBenefit)}.
        Este valor representa o intervalo inicial de captura apos implantacao controlada.
      </article>
    </section>`;
}

function buildChartBootstrapScript(payload: ChartPayload): string {
    const safePayload = JSON.stringify(payload).replace(/</g, "\\u003c");
    return `
window.__REPORT_READY = false;
(function bootstrapReportCharts() {
  const payload = ${safePayload};
  const gold = "#b88a2a";
  const ink = "#111827";
  const slate = "#64748b";

  function drawCharts() {
    if (typeof Chart === "undefined") {
      window.__REPORT_READY = true;
      return;
    }

    const automationCanvas = document.getElementById("chart-automation-score");
    if (automationCanvas && automationCanvas.getContext) {
      new Chart(automationCanvas.getContext("2d"), {
        type: "radar",
        data: {
          labels: ["Atendimento", "Comercial", "Backoffice", "Dados", "Execucao"],
          datasets: [{
            label: "Maturidade atual",
            data: [
              Math.max(10, payload.score * 0.88),
              Math.max(8, payload.score * 0.78),
              Math.max(12, payload.score * 0.72),
              Math.max(11, payload.score * 0.83),
              Math.max(9, payload.score * 0.76)
            ],
            backgroundColor: "rgba(184, 138, 42, 0.22)",
            borderColor: gold,
            borderWidth: 2,
            pointBackgroundColor: gold
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          scales: {
            r: {
              beginAtZero: true,
              max: 100,
              ticks: { color: slate, backdropColor: "transparent" },
              grid: { color: "rgba(100, 116, 139, 0.22)" },
              pointLabels: { color: ink, font: { size: 11 } }
            }
          },
          plugins: { legend: { labels: { color: ink } } }
        }
      });
    }

    const financialCanvas = document.getElementById("chart-financial-impact");
    if (financialCanvas && financialCanvas.getContext) {
      new Chart(financialCanvas.getContext("2d"), {
        type: "bar",
        data: {
          labels: ["Economia", "Receita", "Horas (escala 1000)"],
          datasets: [{
            label: "Impacto mensal",
            data: [payload.financial.savings, payload.financial.revenue, payload.financial.hours * 1000],
            backgroundColor: [gold, "#1f2937", "#475569"],
            borderRadius: 8
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { color: ink }, grid: { display: false } },
            y: { ticks: { color: slate }, grid: { color: "rgba(100,116,139,0.2)" } }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    const efficiencyCanvas = document.getElementById("chart-operational-efficiency");
    if (efficiencyCanvas && efficiencyCanvas.getContext) {
      new Chart(efficiencyCanvas.getContext("2d"), {
        type: "line",
        data: {
          labels: ["Semana 1", "Semana 2", "Semana 3", "Semana 4"],
          datasets: [{
            label: "Indice de eficiencia",
            data: payload.efficiencySeries,
            borderColor: gold,
            backgroundColor: "rgba(184, 138, 42, 0.16)",
            fill: true,
            tension: 0.35,
            pointBackgroundColor: gold,
            pointBorderColor: "#fff",
            pointRadius: 4
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { color: ink }, grid: { display: false } },
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { color: slate },
              grid: { color: "rgba(100,116,139,0.2)" }
            }
          },
          plugins: { legend: { labels: { color: ink } } }
        }
      });
    }

    window.__REPORT_READY = true;
  }

  function startWhenFontsReady() {
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fonts.finally(function() {
      setTimeout(drawCharts, 40);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWhenFontsReady);
  } else {
    startWhenFontsReady();
  }
})();
`;
}

async function loadChartLibraryScript(): Promise<string> {
    if (!chartLibraryCache) {
        chartLibraryCache = (async () => {
            try {
                const chartPath = path.join(process.cwd(), "node_modules", "chart.js", "dist", "chart.umd.js");
                return await readFile(chartPath, "utf8");
            } catch {
                return "";
            }
        })();
    }
    return chartLibraryCache;
}

function escapeScriptTag(value: string): string {
    return value.replace(/<\/script/gi, "<\\/script");
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function safeNumber(value: number): number {
    return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, safeNumber(value)));
}

function nonEmptyOrFallback(items: string[], fallback: string[]): string[] {
    const cleaned = items.map((item) => item.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : fallback;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
    }).format(safeNumber(value));
}
