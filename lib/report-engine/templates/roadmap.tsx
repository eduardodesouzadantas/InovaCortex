import type { ReportTemplateProps } from "@/lib/report-engine/types";

function roadmapRows(data: ReportTemplateProps["data"]) {
    if (data.roadmap.length > 0) return data.roadmap.slice(0, 8);
    return [
        {
            phase: "Fase 1",
            title: "Discovery operacional",
            description: "Mapeamento de processos criticos, gargalos e baseline de metricas.",
            owner: "PM + Operacoes",
            eta: "Semana 1",
        },
        {
            phase: "Fase 2",
            title: "Automacoes de caixa rapido",
            description: "Deploy de fluxos com maior impacto em receita e produtividade.",
            owner: "Squad de Automacao",
            eta: "Semanas 2-3",
        },
        {
            phase: "Fase 3",
            title: "Escala e governanca",
            description: "Observabilidade, ajustes de qualidade e playbooks operacionais.",
            owner: "Lider de Operacoes",
            eta: "Semana 4",
        },
    ];
}

export function RoadmapTemplate({ data }: ReportTemplateProps): string {
    const rows = roadmapRows(data);

    const tableRows = rows
        .map(
            (item) => `<tr>
        <td>${escapeHtml(item.phase)}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>${escapeHtml(item.owner ?? "-")}</td>
        <td>${escapeHtml(item.eta ?? "-")}</td>
      </tr>`
        )
        .join("");

    return `<section class="page">
      <header class="section-header">
        <span class="section-kicker">Pagina 7</span>
        <h2>Implementation Roadmap</h2>
      </header>

      <table class="roadmap-table">
        <thead>
          <tr>
            <th>Fase</th>
            <th>Iniciativa</th>
            <th>Descricao</th>
            <th>Owner</th>
            <th>Prazo</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>

      <article class="chart-panel">
        <h3>Evolucao prevista de eficiencia operacional</h3>
        <canvas id="chart-operational-efficiency"></canvas>
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
