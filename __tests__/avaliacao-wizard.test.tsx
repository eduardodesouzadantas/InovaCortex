/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AvaliacaoWizard from "../app/avaliacao/page";
import "@testing-library/jest-dom";

// Mock do Next.js
jest.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
}));

class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.ResizeObserver = ResizeObserver;
window.scrollTo = jest.fn();

describe("AvaliacaoWizard Flow", () => {
    beforeAll(() => {
        jest.setTimeout(30000);
    });

    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    it("hydrates correctly from localStorage and ensures arrays are kept for multi-selects", async () => {
        const draft = {
            name: "John Draft",
            email: "john@draft.com",
            phone: "11999999999",
            company: "Acme",
            role: "Developer",
            city: "SP",
            segment: "Tech",
            monthlyRevenue: "Até 50k",
            teamSize: "1-10",
            customerVolume: "Menos de 50",
            monthlyLeads: "Menos de 100",
            conversionRate: "Desconhecida",
            responseTime: "Imediato",
            manualTasks: "Copy and paste",
            hoursLost: "Até 2h/dia",
            crmUsage: "Não usamos",
            automationLevel: "Nenhuma",
            urgency: "Baixa",
            goal: "Vender mais",
            pains: [],
            channels: [], // empty to be filled
            stack: [], // empty to be filled
            whatsappConsent: false
        };
        localStorage.setItem("assessment_draft", JSON.stringify(draft));

        render(<AvaliacaoWizard />);

        await waitFor(() => {
            expect((screen.getByLabelText("Nome completo") as HTMLInputElement).value).toBe("John Draft");
        });

        // Multi-select - channels
        const waCheckbox = screen.getByRole("checkbox", { name: "WhatsApp" });
        await userEvent.click(waCheckbox);

        await waitFor(() => {
             const savedNow = JSON.parse(localStorage.getItem("assessment_draft") || "{}");
             expect(savedNow.channels).toContain("WhatsApp");
        });

        // Stack Multi-select
        const stackCheckbox = screen.getByRole("checkbox", { name: "Hubspot" });
        await userEvent.click(stackCheckbox);

        await waitFor(() => {
             const savedNow = JSON.parse(localStorage.getItem("assessment_draft") || "{}");
             expect(savedNow.stack).toContain("Hubspot");
        });

        // Multi-select Pains
        const painCheckbox = screen.getByRole("checkbox", { name: "Tempo de resposta lento" });
        await userEvent.click(painCheckbox);

        // Check whatsappConsent
        const consentCheckbox = screen.getByLabelText(/Aceito receber meu dossiê técnico/i);
        await userEvent.click(consentCheckbox);

        await waitFor(() => {
             const savedFinally = JSON.parse(localStorage.getItem("assessment_draft") || "{}");
             expect(savedFinally.whatsappConsent).toBe(true);
        });
    }, 30000);
});
