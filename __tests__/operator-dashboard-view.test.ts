jest.mock("next/link", () => {
    const ReactModule = jest.requireActual<typeof import("react")>("react");
    return {
        __esModule: true,
        default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
            ReactModule.createElement("a", { href, ...props }, children),
    };
});

import { renderToStaticMarkup } from "react-dom/server";

import { OperatorDashboardView } from "../app/org/[slug]/admin/(authenticated)/_components/operator-dashboard-view";
import type { OperatorSurfaceModel } from "../lib/operator/surface-overview";

function createDashboard(overrides: Partial<OperatorSurfaceModel> = {}): OperatorSurfaceModel {
    return {
        generatedAt: "2026-03-16T12:00:00.000Z",
        overview: {
            headline: "Cockpit operacional de Acme",
            subheadline: "A home do Operator existe para executar o dia.",
            tone: "warning",
            summary: "Ha pendencias concretas exigindo toque operacional agora.",
            focusNow: [
                "Atacar 2 propostas paradas antes de abrir nova frente.",
                "Proteger 2 reunioes do curto prazo para manter ritmo do dia.",
            ],
        },
        operationalDay: {
            title: "Resumo operacional do dia",
            description: "Leitura curta do que esta aberto, vencendo e vindo na agenda imediata.",
            focus: "Comecar pela agenda curta e preservar resposta rapida para nao perder ritmo.",
            metrics: [
                {
                    id: "agenda",
                    label: "Agenda imediata",
                    value: "2",
                    detail: "3 tarefas vencendo hoje",
                    tone: "positive",
                },
            ],
            items: [
                {
                    id: "meeting-1",
                    title: "ceo@globex.com",
                    detail: "Reuniao marcada para 17/03/2026 12:00.",
                    eyebrow: "agenda imediata",
                    href: "#agenda",
                    tone: "positive",
                },
            ],
        },
        followUps: {
            title: "Follow-ups prioritarios",
            description: "O que exige toque comercial ou resposta humana.",
            focus: "Reengajar propostas paradas antes que virem perda silenciosa.",
            metrics: [
                {
                    id: "stale-proposals",
                    label: "Propostas paradas",
                    value: "2",
                    detail: "sem toque recente",
                    tone: "warning",
                },
            ],
            items: [
                {
                    id: "proposal-1",
                    title: "Initech",
                    detail: "Sem follow-up desde 10/03/2026.",
                    eyebrow: "proposta parada",
                    href: "/org/acme/admin/deals",
                    tone: "warning",
                },
            ],
        },
        agenda: {
            title: "Meetings & Agenda",
            description: "Fila de agendas",
            focus: "Registrar resultado",
            metrics: [],
            items: [],
        },
        close: {
            title: "Sales & Close Queue",
            description: "Oportunidades quentes",
            focus: "Cobrar resposta e fechar",
            metrics: [],
            items: [],
        },
        revenue: {
            title: "Revenue Queue",
            description: "Oportunidades em risco",
            focus: "Atacar os deals de alto valor",
            metrics: [],
            items: [],
        },
        proposals: {
            title: "Proposal Queue",
            description: "Propostas enviadas",
            focus: "Focar nas propostas paradas",
            metrics: [],
            items: [],
        },
        queue: {
            title: "Fila e pendencias",
            description: "Inbox, action queue e execucao.",
            focus: "Comecar pela inbox para reduzir tempo de resposta.",
            metrics: [
                {
                    id: "inbox",
                    label: "Inbox pendente",
                    value: "5",
                    detail: "conversas com unread count",
                    tone: "warning",
                },
            ],
            items: [
                {
                    id: "queue-1",
                    title: "Inbox com pendencia",
                    detail: "5 conversas com mensagens nao tratadas.",
                    eyebrow: "whatsapp crm",
                    href: "/org/acme/admin/whatsapp",
                    tone: "warning",
                },
            ],
        },
        loss: {
            title: "Loss Intelligence",
            description: "Analise de vazamento real do funil com visao de recuperacao.",
            focus: "Triar perdas recentes e identificar oportunidades de reativacao.",
            metrics: [],
            items: [],
        },
        warnings: [],
        ...overrides,
    };
}

describe("Operator dashboard view", () => {
    test("renders an execution-first operator cockpit", () => {
        const html = renderToStaticMarkup(
            OperatorDashboardView({
                data: createDashboard(),
                slug: "acme",
                showExecutiveBridge: true,
            }),
        );

        expect(html).toContain("Tenant Operator Surface v3");
        expect(html).toContain("Operacao agora");
        expect(html).toContain("Resumo operacional");
        expect(html).toContain("Follow-ups prioritarios");
        expect(html).toContain("Fila e pendencias");
        expect(html).toContain("Ir para CEO Surface");
    });

    test("renders safe fallbacks when operational signals are sparse", () => {
        const html = renderToStaticMarkup(
            OperatorDashboardView({
                data: createDashboard({
                    operationalDay: {
                        title: "Resumo operacional do dia",
                        description: "Leitura curta do que esta aberto, vencendo e vindo na agenda imediata.",
                        focus: "A rotina esta sob controle e permite concentrar energia nos proximos follow-ups.",
                        metrics: [],
                        items: [],
                    },
                    followUps: {
                        title: "Follow-ups prioritarios",
                        description: "O que exige toque comercial ou resposta humana.",
                        focus: "Sem follow-up prioritario muito forte agora; manter a disciplina da rotina.",
                        metrics: [],
                        items: [],
                    },
                    queue: {
                        title: "Fila e pendencias",
                        description: "Inbox, action queue e execucao.",
                        focus: "Fila operacional leve no momento.",
                        metrics: [],
                        items: [],
                    },
                    close: {
                        title: "Sales & Close Queue",
                        description: "Sem fechamentos hoje",
                        focus: "Trabalhar topo de funil",
                        metrics: [],
                        items: [],
                    },
                    warnings: [
                        "A trilha operacional imediata ainda esta rasa, entao a home mostra apenas sinais honestos do que existe.",
                    ],
                    revenue: {
                        title: "Revenue Queue",
                        description: "Oportunidades em risco",
                        focus: "Atacar os deals de alto valor",
                        metrics: [],
                        items: [],
                    },
                    proposals: {
                        title: "Proposal Queue",
                        description: "Propostas enviadas",
                        focus: "Focar nas propostas paradas",
                        metrics: [],
                        items: [],
                    },
                }),
                slug: "acme",
                showExecutiveBridge: false,
            }),
        );

        expect(html).toContain("Ainda nao ha agenda ou atraso operacional suficiente");
        expect(html).toContain("Sem follow-ups com calor suficiente");
        expect(html).toContain("Sem fila operacional relevante");
        expect(html).toContain("Leitura honesta");
        expect(html).not.toContain("Ir para CEO Surface");
    });
});
