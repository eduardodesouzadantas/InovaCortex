import type { ReportTemplateProps } from "@/lib/report-engine/types";

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0);
}

export function FinancialImpactTemplate({ data }: ReportTemplateProps): string {
    const roi = data.roi;
    return `<section class="page">
      <header class="section-header">
        <span class="section-kicker">Pagina 4</span>
        <h2>Financial Impact Analysis</h2>
      </header>

      <div class="kpi-grid">
        <article class="kpi-card">
          <p class="metric-label">Economia operacional mensal</p>
          <p class="metric-value">${formatCurrency(roi.operationalSavingsEstimate)}</p>
          <p class="metric-caption">${escapeHtml(roi.savingsRange ?? "Estimativa conservadora")}</p>
        </article>
        <article class="kpi-card">
          <p class="metric-label">Aumento mensal de receita</p>
          <p class="metric-value">${formatCurrency(roi.revenueIncreaseEstimate)}</p>
          <p class="metric-caption">${escapeHtml(roi.revenueRange ?? "Projecao de incremento")}</p>
        </article>
        <article class="kpi-card">
          <p class="metric-label">Horas recuperadas por mes</p>
          <p class="metric-value">${Math.round(roi.monthlyHoursRecovered)}h</p>
          <p class="metric-caption">${escapeHtml(roi.hoursRange ?? "Capacidade adicional do time")}</p>
        </article>
        <article class="kpi-card">
          <p class="metric-label">Payback estimado</p>
          <p class="metric-value">${roi.estimatedPaybackMonths.toFixed(1)} meses</p>
          <p class="metric-caption">Confianca: ${escapeHtml(roi.confidenceLevel)}</p>
        </article>
      </div>

      <article class="chart-panel">
        <h3>Composicao do impacto financeiro</h3>
        <canvas id="chart-financial-impact"></canvas>
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
