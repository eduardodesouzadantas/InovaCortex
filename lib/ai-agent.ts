import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

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

export async function generatePreSalesArtifacts(
  assessment: AssessmentContext
): Promise<PreSalesResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured. Please add it to your .env file.");
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
