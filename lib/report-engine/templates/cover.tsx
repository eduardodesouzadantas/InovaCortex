import type { ReportTemplateProps } from "@/lib/report-engine/types";

export function CoverTemplate({ data }: ReportTemplateProps): string {
    return `<section class="page page-cover">
      <div class="cover-topline">InovaCortex AI Business MRI</div>
      <h1>Relatorio Estrategico de Automacao</h1>
      <p class="cover-subtitle">
        Diagnostico executivo para acelerar crescimento, margem e previsibilidade operacional.
      </p>

      <div class="cover-grid">
        <article class="cover-card">
          <h2>Empresa</h2>
          <p class="cover-highlight">${escapeHtml(data.companyName)}</p>
        </article>
        <article class="cover-card">
          <h2>Classificacao</h2>
          <p class="cover-highlight">${escapeHtml(data.classification)}</p>
        </article>
        <article class="cover-card">
          <h2>Automation Score</h2>
          <p class="cover-highlight">${Math.round(data.scoreTotal)}/100</p>
        </article>
        <article class="cover-card">
          <h2>Gerado em</h2>
          <p class="cover-highlight">${escapeHtml(data.generatedAtLabel)}</p>
        </article>
      </div>

      <footer class="cover-footer">
        Documento confidencial. Uso exclusivo de decisores autorizados da organizacao.
      </footer>
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
