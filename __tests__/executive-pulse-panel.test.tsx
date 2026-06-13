/**
 * @jest-environment jsdom
 */

import { act, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { ExecutivePulsePanel } from "../app/org/[slug]/executive/_components/executive-pulse-panel";

function createAlert(overrides: Partial<Parameters<typeof ExecutivePulsePanel>[0]["alerts"][number]> = {}) {
    return {
        id: "alert-1",
        pulseKey: "stalled_deal::proposal stale",
        title: "proposal stale",
        severity: "critical" as const,
        source: "system_event" as const,
        impact: "Risco imediato",
        message: "Propostas travadas ha mais de 72 horas.",
        createdAt: "2026-03-16T10:00:00.000Z",
        whyNow: "Priorizado por ser um sinal critico recente vindo da operacao real.",
        recommendedFocus: "Triar a origem do alerta e cobrar correcao com responsavel claro.",
        status: "open" as const,
        lastActionAt: null,
        lastActionBy: null,
        linkedEntityType: "deal" as const,
        linkedEntityId: "deal-1",
        category: "stalled_deal" as const,
        categoryLabel: "Negocio travado",
        cta: "demand_action" as const,
        ctaLabel: "Cobrar execucao",
        ...overrides,
    };
}

describe("ExecutivePulsePanel", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
    });

    it("renders state filters and keeps executive ordering within the selected subset", async () => {
        const user = userEvent.setup();

        render(
            <ExecutivePulsePanel
                orgSlug="acme"
                alerts={[
                    createAlert({
                        pulseKey: "resolved::deal-1",
                        title: "Deal resolvido",
                        status: "resolved",
                        category: "recovery",
                        categoryLabel: "Retomada em curso",
                        ctaLabel: "Acompanhar retomada",
                    }),
                    createAlert({
                        pulseKey: "open::deal-2",
                        title: "Deal aberto 1",
                        status: "open",
                    }),
                    createAlert({
                        pulseKey: "open::deal-3",
                        title: "Deal aberto 2",
                        status: "open",
                    }),
                ]}
            />,
        );

        expect(screen.getByRole("button", { name: /Todos 3/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Abertos 2/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Em acompanhamento 0/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Delegados 0/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Resolvidos 1/i })).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /Abertos 2/i }));

        const firstOpen = screen.getByText("Deal aberto 1");
        const secondOpen = screen.getByText("Deal aberto 2");
        expect(firstOpen).toBeInTheDocument();
        expect(secondOpen).toBeInTheDocument();
        expect(firstOpen.compareDocumentPosition(secondOpen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.queryByText("Deal resolvido")).not.toBeInTheDocument();
        expect(screen.getByText(/Filtro de leitura apenas/i)).toBeInTheDocument();
    });

    it("shows an executive empty state for filters with no matching alerts", async () => {
        const user = userEvent.setup();

        render(
            <ExecutivePulsePanel
                orgSlug="acme"
                alerts={[createAlert({ status: "open" })]}
            />,
        );

        await user.click(screen.getByRole("button", { name: /Resolvidos 0/i }));

        expect(screen.getByText(/Nenhum alerta executivo neste recorte/i)).toBeInTheDocument();
        expect(screen.getByText(/O filtro apenas organiza a leitura/i)).toBeInTheDocument();
    });

    it("renders status, actions and linked entity labels", () => {
        render(
            <ExecutivePulsePanel
                orgSlug="acme"
                alerts={[createAlert()]}
            />,
        );

        expect(screen.getByText("CEO Pulse")).toBeInTheDocument();
        expect(screen.getByText("Aberto")).toBeInTheDocument();
        expect(screen.getByText("Vinculado a deal")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Acompanhar/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Delegar/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Marcar como resolvido/i })).toBeInTheDocument();
        expect(screen.getByText(/O sync automatico continua ativo/i)).toBeInTheDocument();
    });

    it("updates the card locally after a successful pulse action", async () => {
        const user = userEvent.setup();
        let resolveFetch!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
        const pendingFetch = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
            resolveFetch = resolve;
        });

        (global.fetch as jest.Mock).mockReturnValueOnce(pendingFetch);

        render(
            <ExecutivePulsePanel
                orgSlug="acme"
                alerts={[createAlert()]}
            />,
        );

        const actionButton = screen.getByRole("button", { name: /Acompanhar/i });
        await user.click(actionButton);

        expect(actionButton).toBeDisabled();
        expect(global.fetch).toHaveBeenCalledWith("/api/org/acme/executive/pulse-actions", expect.objectContaining({
            method: "POST",
        }));
        expect(screen.getByRole("button", { name: /Abertos 0/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Em acompanhamento 1/i })).toBeInTheDocument();

        await act(async () => {
            resolveFetch({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    data: {
                        alertState: {
                            pulseKey: "stalled_deal::proposal stale",
                            status: "tracking",
                            lastActionAt: "2026-03-18T12:00:00.000Z",
                            lastActionBy: "ceo@acme.com",
                            linkedEntityType: "deal",
                            linkedEntityId: "deal-1",
                        },
                    },
                }),
            });
        });

        await waitFor(() => {
            const alertCard = screen.getByText("proposal stale").closest("article");
            expect(alertCard).not.toBeNull();
            expect(within(alertCard as HTMLElement).getByText("Em acompanhamento")).toBeInTheDocument();
        });
        expect(screen.getByText(/Por ceo@acme.com/i)).toBeInTheDocument();
        expect(screen.getByText(/Atualizado.*18\/03\/2026/i)).toBeInTheDocument();
    });

    it("shows a safe error message when the backend rejects the action", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            json: () => Promise.resolve({
                success: false,
                error: "FAILED_TO_RECORD_PULSE_ACTION",
                message: "Falha ao registrar a ação.",
            }),
        });

        render(
            <ExecutivePulsePanel
                orgSlug="acme"
                alerts={[createAlert()]}
            />,
        );

        await user.click(screen.getByRole("button", { name: /Delegar/i }));

        await waitFor(() => {
            expect(screen.getByText("Falha ao registrar a ação.")).toBeInTheDocument();
        });
    });
});
