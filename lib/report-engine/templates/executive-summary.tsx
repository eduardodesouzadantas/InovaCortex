import type { ReportTemplateProps } from "@/lib/report-engine/types";

function firstItems(items: string[], max: number): string[] {
    return items.slice(0, max);
}

export function ExecutiveSummaryTemplate({ data }: ReportTemplateProps): string {
    const missions = firstItems(data.recommendedMissions, 6)
        .map((mission) => `<li>${escapeHtml(mission)}</li>`)
        .join("");
    const pains = firstItems(data.pains, 6)
        .map((pain) => `<li>${escapeHtml(pain)}</li>`)
        .join("");

    return `<section class="page">
      <header class="section-header">
        <span class="section-kicker">Pagina 2</span>
        <h2>Executive Summary</h2>
      </header>

      <article class="summary-block">
        <p>${escapeHtml(data.summary)}</p>
      </article>

      <div class="two-col">
        <article class="panel">
          <h3>Missoes prioritarias</h3>
          <ul class="bullet-list">${missions}</ul>
        </article>
        <article class="panel">
          <h3>Pontos de dor detectados</h3>
          <ul class="bullet-list">${pains}</ul>
        </article>
      </div>

      <article class="quote-block">
        <p>
          Recomendacao executiva: iniciar em 30 dias com foco em quick wins de caixa e
          padronizacao operacional para destravar escala sem ampliar custo fixo.
        </p>
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
