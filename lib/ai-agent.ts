import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { logger } from "@/lib/logger";

interface AssessmentContext {
  name: string;
  company: string;
  role: string;
  segment: string;
  teamSize: string;
  volumeDay: string;
  channels: string[];
  stack: string[];
  pains: string[];
  urgency: string;
  goal: string;
  scoreTotal: number;
  scoreBreakdown: Record<string, number>;
  classification: string;
  recommendedMissions: string[];
}

export interface PreSalesResult {
  executiveSummary: string;
  diagnosticQuestions: string[];
  initialArchitecture: {
    blocks: { title: string; description: string }[];
    integrations: string[];
    roadmap: { week: string; action: string }[];
  };
}

function buildStubPreSalesResult(assessment: AssessmentContext): PreSalesResult {
  return {
    executiveSummary: [
      `${assessment.company} possui oportunidade relevante de eficiência em ${assessment.segment}.`,
      "OPENAI_API_KEY não configurada: resultado gerado em modo degradado para manter continuidade operacional.",
      `Foco imediato: consolidar dores (${assessment.pains.slice(0, 3).join(", ") || "operações críticas"}) e validar metas de curto prazo.`,
    ].join(" "),
    diagnosticQuestions: [
      "Qual processo atual gera maior perda de receita ou retrabalho?",
      "Qual canal concentra maior volume e pior tempo de resposta?",
      "Quais integrações são obrigatórias para começar sem fricção?",
      "Qual meta executiva será usada para medir o sucesso em 30 dias?",
      "Quem será o responsável por operação e governança da implantação?",
      "Quais riscos podem atrasar a adoção nas primeiras semanas?",
      "Quais decisões dependem de visibilidade em tempo real no cockpit?",
    ],
    initialArchitecture: {
      blocks: [
        { title: "Orquestração Comercial", description: "Coordena pipeline, prioridades e próximas ações." },
        { title: "Automação Operacional", description: "Executa playbooks e reduz tarefas manuais recorrentes." },
      ],
      integrations: assessment.stack.length > 0 ? assessment.stack.slice(0, 4) : ["CRM", "WhatsApp Business API"],
      roadmap: [
        { week: "Semana 1-2", action: "Mapeamento de gargalos e baseline de métricas." },
        { week: "Semana 3-4", action: "Integrações críticas e ativação do primeiro ciclo operacional." },
      ],
    },
  };
}

export async function generatePreSalesArtifacts(
  assessment: AssessmentContext
): Promise<PreSalesResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn("OPENAI_API_KEY not configured; using legacy pre-sales stub output", {
      mode: "degraded",
      company: assessment.company,
    });
    return buildStubPreSalesResult(assessment);
  }

  const openai = createOpenAI({ apiKey });

  const prompt = `Você é um Arquiteto de IA B2B sênior da InovaCortex. Baseado nos dados de avaliação abaixo, gere 3 artefatos de pré-venda profissionais em JSON estruturado.

# Dados do Lead
- **Nome:** ${assessment.name}
- **Empresa:** ${assessment.company} | **Cargo:** ${assessment.role}
- **Segmento:** ${assessment.segment} | **Equipe:** ${assessment.teamSize}
- **Volume/dia:** ${assessment.volumeDay}
- **Canais atuais:** ${assessment.channels.join(", ")}
- **Stack atual:** ${assessment.stack.join(", ")}
- **Principais dores:** ${assessment.pains.join(", ")}
- **Urgência:** ${assessment.urgency} | **Objetivo primário:** ${assessment.goal}
- **Score InovaCortex:** ${assessment.scoreTotal}/100 (${assessment.classification})
- **Missões recomendadas:** ${assessment.recommendedMissions.join(", ")}

# Instruções de Saída
Responda APENAS com um JSON válido (sem markdown, sem textos extras) no seguinte formato:

{
  "executiveSummary": "Resumo executivo de 1 página em prosa rica, apresentando o perfil do lead, a oportunidade de automação identificada, e o valor gerado pela parceria com InovaCortex. Use linguagem consultiva e profissional.",
  "diagnosticQuestions": [
    "Pergunta 1 objetiva para a call de descoberta",
    "Pergunta 2 ...",
    "Pergunta 3 ...",
    "Pergunta 4 ...",
    "Pergunta 5 ...",
    "Pergunta 6 ...",
    "Pergunta 7 ..."
  ],
  "initialArchitecture": {
    "blocks": [
      { "title": "Nome do módulo/agente", "description": "O que ele faz e qual dor resolve" }
    ],
    "integrations": ["Lista de sistemas a integrar, ex: WhatsApp Business API", "CRM HubSpot"],
    "roadmap": [
      { "week": "Semana 1-2", "action": "O que acontece nessa sprint" },
      { "week": "Semana 3-4", "action": "Próxima entrega" }
    ]
  }
}

Seja específico e personalizado para este lead. Use nomes reais de ferramentas e contexto do segmento ${assessment.segment}.`;

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt,
    temperature: 0.7,
    maxOutputTokens: 2000,
  });

  // Strip markdown code blocks if present
  const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(clean) as PreSalesResult;
}
