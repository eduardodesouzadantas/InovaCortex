/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MobileCommandSurfaceClient } from "@/app/mobile/mobile-command-surface-client";

jest.mock("@/app/org/[slug]/executive/_components/executive-pulse-panel", () => ({
    ExecutivePulsePanel: () => <div data-testid="pulse-panel">Pulse painel</div>,
}));

const baseData = {
    org: {
        id: "org-1",
        slug: "acme",
        name: "Acme",
        plan: "enterprise",
    },
    generatedAt: "2026-03-18T12:00:00.000Z",
    overview: {
        headline: "Headline",
        subheadline: "Subheadline",
    },
    decisionNarrative: {
        tone: "neutral",
        summary: "Summary",
        stateOfPlay: "State",
        biggestRisk: "Risk",
        biggestOpportunity: "Opportunity",
        focusNow: ["Cobrar operação", "Revisar pipeline"],
    },
    summaryCards: [
        { id: "revenue", title: "Receita", value: "R$ 10k", detail: "Detail", tone: "positive" },
        { id: "risk", title: "Risco", value: "3", detail: "Detail", tone: "critical" },
    ],
    prioritizedAlerts: [
        {
            pulseKey: "pulse-1",
            title: "Deal travado",
            summary: "Sem avanço",
            category: "stalled_deal",
            severity: "high",
            priority: 1,
            status: "open",
            linkedEntityId: "deal-1",
            linkedEntityType: "deal",
            ctaCode: "review_pipeline",
            ctaLabel: "Revisar pipeline",
        },
    ],
    inboxItems: [
        {
            id: "wa-1",
            channel: "whatsapp",
            title: "WhatsApp A",
            preview: "Agora",
            status: "open",
            unreadCount: 2,
            lastMessageAt: "2026-03-18T12:30:00.000Z",
            contactName: "Ana",
            contactEmail: "ana@example.com",
            replyHint: "Envia no WhatsApp",
            conversationId: "wa-1",
            threadId: null,
            dealId: null,
        },
        {
            id: "email-1",
            channel: "email",
            title: "Email B",
            preview: "Email agora",
            status: "open",
            unreadCount: 1,
            lastMessageAt: "2026-03-18T12:20:00.000Z",
            contactName: "Bea",
            contactEmail: "bea@example.com",
            replyHint: "Registra follow-up no deal",
            conversationId: null,
            threadId: "email-1",
            dealId: "deal-1",
        },
    ],
    recentDeals: [
        {
            id: "deal-1",
            contactId: "con-1",
            contact: {
                id: "con-1",
                name: "Ana",
                email: "ana@example.com",
                phoneNumberE164: "+5511999999999",
                lifecycle: "lead",
                tags: [],
            },
            stage: {
                id: "stage-1",
                name: "Proposta",
                pipelineId: "pipe-1",
            },
            value: 12000,
            status: "open",
            activityCount: 3,
            createdAt: "2026-03-18T11:00:00.000Z",
        },
    ],
};

describe("MobileCommandSurfaceClient", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        global.fetch = jest.fn();
    });

    it("renders tabs and the pulse surface", async () => {
        render(<MobileCommandSurfaceClient slug="acme" data={baseData as any} />);

        expect(screen.getByText("Mobile Command Surface")).toBeInTheDocument();
        expect(screen.getByTestId("pulse-panel")).toBeInTheDocument();

        await userEvent.click(screen.getAllByRole("button", { name: /Resumo/i })[0]);
        expect(screen.getByText("Leitura rapida")).toBeInTheDocument();

        await userEvent.click(screen.getAllByRole("button", { name: /Inbox/i })[0]);
        expect(screen.getByText("WhatsApp + Email")).toBeInTheDocument();

        await userEvent.click(screen.getAllByRole("button", { name: /Ações/i })[0]);
        expect(screen.getByText("Deals em foco")).toBeInTheDocument();
    });

    it("sends WhatsApp replies from the inbox", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true }),
        });

        render(<MobileCommandSurfaceClient slug="acme" data={baseData as any} />);
        await userEvent.click(screen.getAllByRole("button", { name: /Inbox/i })[0]);
        await userEvent.type(screen.getByPlaceholderText(/Digite a resposta curta/i), "Vamos falar amanhã");
        await userEvent.click(screen.getByRole("button", { name: /Enviar resposta/i }));

        expect(global.fetch).toHaveBeenCalledWith(
            "/api/org/acme/whatsapp/send",
            expect.objectContaining({
                method: "POST",
            }),
        );
    });

    it("registers a quick deal action", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });

        render(<MobileCommandSurfaceClient slug="acme" data={baseData as any} />);
        await userEvent.click(screen.getAllByRole("button", { name: /Ações/i })[0]);
        await userEvent.click(screen.getByRole("button", { name: /Ganho/i }));

        expect(global.fetch).toHaveBeenCalledWith(
            "/api/org/acme/mobile/actions",
            expect.objectContaining({
                method: "POST",
            }),
        );
    });
});
