import type { ReportTemplateProps } from "@/lib/report-engine/types";

function clampScore(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

export function AutomationScoreTemplate({ data }: ReportTemplateProps): string {
    const score = clampScore(data.scoreTotal);
    const maturity = score >= 75 ? "Alta maturidade" : score >= 45 ? "Maturidade intermediaria" : "Baixa maturidade";

    return `<section class="page">
      <header class="section-header">
        <span class="section-kicker">Pagina 3</span>
        <h2>Automation Scorecard</h2>
      </header>

      <div class="score-grid">
        <article class="score-card">
          <p class="metric-label">Score Geral</p>
          <p class="metric-value">${score}/100</p>
          <p class="metric-caption">${maturity}</p>
        </article>
        <article class="score-card">
          <p class="metric-label">Classificacao</p>
          <p class="metric-value small">${escapeHtml(data.classification)}</p>
          <p class="metric-caption">Prioridade de implementacao</p>
        </article>
      </div>

      <article class="chart-panel">
        <h3>Radar de capacidade operacional</h3>
        <canvas id="chart-automation-score"></canvas>
      </article>
    </section>`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
