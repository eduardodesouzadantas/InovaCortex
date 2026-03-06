import { prisma } from "@/lib/prisma";

export interface ExperimentDraft {
    hypothesis: string;
    metricKey: string;
    planJson: any;
    impact: number;
    confidence: number;
    effort: number;
    score: number;
}

/**
 * Builds a list of potential experiment drafts based on a bottleneck.
 */
export function buildExperimentDrafts(bottleneckType: string): ExperimentDraft[] {
    const drafts: ExperimentDraft[] = [];

    if (bottleneckType === 'acceptance') {
        drafts.push({
            hypothesis: "Adicionar 3 cases de sucesso na seção de benefícios da proposta aumentará o aceite em 15%.",
            metricKey: "proposal_acceptance",
            planJson: {
                variants: ["Controle (S/ Cases)", "Variante (C/ Cases)"],
                steps: ["Selecionar 3 cases do setor", "Inserir na proposta PDF", "Monitorar taxa de cliques/aceite"],
                owner: "Marketing/Sales"
            },
            impact: 7,
            confidence: 6,
            effort: 3,
            score: 0
        });

        drafts.push({
            hypothesis: "Dividir o pagamento em 10x (mesmo valor total) melhorará a percepção de custo e aumentará o aceite.",
            metricKey: "proposal_acceptance",
            planJson: {
                variants: ["Pagamento 3x", "Pagamento 10x"],
                steps: ["Configurar gateway", "Alterar template de proposta", "Rodar por 30 dias"],
                owner: "Finance/Sales"
            },
            impact: 6,
            confidence: 5,
            effort: 5,
            score: 0
        });
    }

    if (bottleneckType === 'show_rate') {
        drafts.push({
            hypothesis: "Enviar um vídeo personalizado de 30s após o agendamento aumentará o show-rate em 20%.",
            metricKey: "meeting_show_rate",
            planJson: {
                variants: ["Lembrete Texto", "Lembrete Texto + Vídeo"],
                steps: ["Gravar vídeo padrão", "Configurar automação WhatsApp", "Medir comparecimento"],
                owner: "SDR/Ops"
            },
            impact: 9,
            confidence: 7,
            effort: 4,
            score: 0
        });
    }

    if (bottleneckType === 'velocity') {
        drafts.push({
            hypothesis: "Implementar um 'early bird discount' válido por apenas 48h cortará o ciclo de vendas pela metade.",
            metricKey: "pipeline_velocity",
            planJson: {
                variants: ["Sem Desconto", "Desconto 10% (48h)"],
                steps: ["Criar código de desconto", "Informar via WhatsApp", "Validar data de fechamento"],
                owner: "CEO/Sales"
            },
            impact: 8,
            confidence: 4,
            effort: 2,
            score: 0
        });
    }

    // Scoting using ICE or similar (Impact * Confidence * (10 - Effort))
    return drafts.map(d => ({
        ...d,
        score: (d.impact * d.confidence * (11 - d.effort)) / 10
    })).sort((a, b) => b.score - a.score);
}

/**
 * Persists an experiment plan to the database.
 */
export async function createExperimentPlan(orgId: string, draft: ExperimentDraft) {
    return prisma.experimentPlan.create({
        data: {
            organizationId: orgId,
            hypothesis: draft.hypothesis,
            metricKey: draft.metricKey,
            planJson: JSON.stringify(draft.planJson),
            status: "draft"
        }
    });
}
