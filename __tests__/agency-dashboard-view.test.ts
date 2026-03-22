jest.mock("next/link", () => {
    const ReactModule = jest.requireActual<typeof import("react")>("react");
    return {
        __esModule: true,
        default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
            ReactModule.createElement("a", { href, ...props }, children),
    };
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AgencyDashboardView, applyPlaybookUpdate } from "../app/agency/_components/agency-dashboard-view";
import type { AgencySurfaceModel } from "../lib/agency/surface-overview";

function createDashboard(overrides: Partial<AgencySurfaceModel> = {}): AgencySurfaceModel {
    return {
        generatedAt: "2026-03-16T12:00:00.000Z",
        overview: {
            headline: "Agency Surface v2: control plane da plataforma e operating system da propria agencia.",
            subheadline: "A mesma superficie separa governanca da plataforma e operacao propria.",
            commandTone: "warning",
            commandSummary: "A superficie esta funcional, mas ha sinais pendentes tanto na plataforma quanto na operacao propria da agencia.",
            focusNow: [
                "Triar 2 sinais criticos no control plane.",
                "Cobrar follow-up nas 2 propostas paradas da agencia.",
            ],
        },
        controlPlane: {
            title: "Platform Control",
            description: "Governanca da carteira, rollout e observabilidade.",
            focus: "Priorizar os sinais criticos da plataforma antes de expandir novos rollouts.",
            metrics: [
                {
                    id: "tenants",
                    label: "Tenants ativos no radar",
                    value: "12",
                    detail: "3 criados nos ultimos 30 dias",
                    tone: "positive",
                },
            ],
            items: [
                {
                    id: "org-1",
                    eyebrow: "tenant recente",
                    title: "Acme",
                    detail: "growth · active · entrou em 15/03/2026",
                    href: "/agency/commercial/workspaces",
                    tone: "neutral",
                },
            ],
        },
        agencyOps: {
            title: "Agency Operating System",
            description: "Pipeline proprio, agenda, inbox e growth.",
            focus: "Fechar follow-up comercial parado antes que a operacao da agencia perca tracao.",
            metrics: [
                {
                    id: "agency-open-revenue",
                    label: "Receita aberta da agencia",
                    value: "R$ 1.000",
                    detail: "Pipeline aberto da operacao comercial da agencia",
                    tone: "warning",
                },
                {
                    id: "agency-revenue-at-risk",
                    label: "Receita em risco da agencia",
                    value: "R$ 200",
                    detail: "Estimativa de receita vulneravel por propostas/deals sem avanco",
                    tone: "positive",
                },
                {
                    id: "agency-leads",
                    label: "Leads da agencia",
                    value: "18",
                    detail: "5 propostas ativas no ciclo",
                    tone: "positive",
                },
            ],
            items: [
                {
                    id: "proposal-1",
                    eyebrow: "follow-up comercial",
                    title: "Globex",
                    detail: "Proposta sem toque recente desde 12/03/2026.",
                    href: "/agency/commercial/leads",
                    tone: "warning",
                },
                {
                    id: "meeting-1",
                    eyebrow: "agenda imediata",
                    title: "ceo@acme.com",
                    detail: "Reuniao marcada para 18/03/2026 12:00.",
                    href: "/agency/commercial/leads",
                    tone: "positive",
                },
            ],
        },
        proofOfValue: {
            tone: "positive",
            headline: "Impacto consolidado",
            impactMetrics: [
                { id: "v1", label: "Propostas", value: "10", detail: "detalhe", tone: "positive" },
            ],
            insights: ["insight 1"],
        },
        priorityQueue: [
            { id: "t1", slug: "t1", name: "Tenant 1", reason: "motivo", impact: "alto", suggestedAction: "acao", tone: "critical" },
        ],
        benchmarks: [
            { label: "Conversao", avgValue: "15%", topValue: "25%", insight: "insight conversion" },
        ],
        retentionSignals: [
            { id: "r1", tenantName: "R-Tenant", slug: "r", type: "retention", label: "Churn Risk", detail: "detailed", tone: "critical", suggestedAction: "call them" },
        ],
        expansionSignals: [
            { id: "e1", tenantName: "E-Tenant", slug: "e", type: "expansion", label: "Upsell", detail: "detailed", tone: "positive", suggestedAction: "upgrade them" },
        ],
        successPlaybooks: [
            {
                id: "pb1",
                tenantName: "P-Tenant",
                slug: "p",
                playbookName: "Success Play",
                reason: "Good reason",
                suggestedAction: "action",
                expectedImpact: "huge",
                tone: "positive",
                status: "suggested",
                createdAt: "2026-03-16T12:00:00.000Z",
            },
        ],
        playbookTimeline: [],
        warnings: [],
        ...overrides,
    };
}

describe("Agency dashboard view", () => {
    test("renders the dual control-plane and agency-ops reading", () => {
        const html = renderToStaticMarkup(
            React.createElement(AgencyDashboardView, { data: createDashboard() }),
        );

        expect(html).toContain("Agency Surface v2");
        expect(html).toContain("Command center");
        expect(html).toContain("Platform Control");
        expect(html).toContain("Agency Operating System");
        expect(html).toContain("Dualidade materializada");
        expect(html).toContain("Globex");
        expect(html).toContain("Receita aberta da agencia");
        expect(html).toContain("Receita em risco da agencia");
        expect(html).toContain("Retention Signals");
        expect(html).toContain("R-Tenant");
        expect(html).toContain("Expansion signals");
        expect(html).toContain("E-Tenant");
        expect(html).toContain("Success Playbooks");
        expect(html).toContain("P-Tenant");
        expect(html).toContain("Good reason");
    });

    test("applyPlaybookUpdate replaces playbook state locally", () => {
        const old = [
            { id: "pb1", status: "suggested", owner: undefined, createdAt: "2026-03-16T12:00:00.000Z" },
            { id: "pb2", status: "in-progress", owner: "me", createdAt: "2026-03-16T12:00:00.000Z" },
        ] as any;
        const updated = { id: "pb1", status: "completed", owner: "me", completedAt: "2026-03-18T13:00:00.000Z" } as any;

        const result = applyPlaybookUpdate(old, updated);

        expect(result).toHaveLength(2);
        expect(result.find((p) => p.id === "pb1")).toEqual(expect.objectContaining({ status: "completed", owner: "me", completedAt: "2026-03-18T13:00:00.000Z" }));
        expect(result.find((p) => p.id === "pb2")).toEqual(expect.objectContaining({ status: "in-progress" }));
    });

    test("renders playbook execution status and quick actions", () => {
        const html = renderToStaticMarkup(
            React.createElement(AgencyDashboardView, {
                data: createDashboard({
                    successPlaybooks: [
                        {
                            id: "pb1",
                            tenantName: "P-Tenant",
                            slug: "p",
                            playbookName: "Success Play",
                            reason: "Good reason",
                            suggestedAction: "action",
                            expectedImpact: "huge",
                            tone: "positive",
                            status: "in-progress",
                            owner: "operator",
                            createdAt: "2026-03-16T12:00:00.000Z",
                            startedAt: "2026-03-16T13:00:00.000Z",
                        },
                    ],
                }),
            }),
        );

        expect(html).toContain("Em andamento");
        expect(html).toContain("Responsável: operator");
        expect(html).toContain("Marcar concluído");
        expect(html).toContain("Marcar bloqueado");
    });

    test("renders timeline and impact log entries", () => {
        const html = renderToStaticMarkup(
            React.createElement(AgencyDashboardView, {
                data: createDashboard({
                    playbookTimeline: [
                        {
                            playbookId: "pb1",
                            tenantName: "P-Tenant",
                            playbookName: "Success Play",
                            status: "completed",
                            owner: "operator",
                            createdAt: "2026-03-16T12:00:00.000Z",
                            startedAt: "2026-03-16T13:00:00.000Z",
                            completedAt: "2026-03-16T14:00:00.000Z",
                            updatedAt: "2026-03-16T14:00:00.000Z",
                            observedImpact: "Impacto medido",
                        },
                    ],
                }),
            }),
        );

        expect(html).toContain("Agency Timeline");
        expect(html).toContain("P-Tenant");
        expect(html).toContain("Success Play");
        expect(html).toContain("Impacto observado: Impacto medido");
    });

    test("renders safe fallback states when signals are partial", () => {
        const html = renderToStaticMarkup(
            React.createElement(AgencyDashboardView, {
                data: createDashboard({
                    agencyOps: {
                        title: "Agency Operating System",
                        description: "Pipeline proprio, agenda, inbox e growth.",
                        focus: "A operacao da agencia esta conectada, mas ainda com pouca massa para leitura de prioridade mais forte.",
                        metrics: [],
                        items: [],
                    },
                    warnings: [
                        "Ainda nao ha tenant recente suficiente para leitura mais rica de rollout e prova de valor.",
                    ],
                }),
            }),
        );

        expect(html).toContain("A operacao propria da agencia ainda nao gerou agenda");
        expect(html).toContain("Leitura honesta");
        expect(html).toContain("Ainda nao ha tenant recente suficiente");
    });
});
