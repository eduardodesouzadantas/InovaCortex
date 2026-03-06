import { describe, it, expect } from "vitest";
import { generateContract, ContractInput } from "@/lib/contract-engine";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const modules = [
    { title: "Agente de Triagem", description: "IA para triagem de leads", estimatedWeeks: 2, basePrice: 5000, deliverables: ["Bot configurado", "Dashboard"], included: true },
    { title: "Integração CRM", description: "Conexão com CRM", estimatedWeeks: 1, basePrice: 2000, deliverables: ["Webhook CRM"], included: true },
    { title: "Módulo Inativo", description: "Não incluído", estimatedWeeks: 1, basePrice: 999, deliverables: [], included: false },
];

const minInput: ContractInput = {
    proposal: {
        id: "prop-001",
        version: 1,
        modules: JSON.stringify(modules),
        pricingEstimate: JSON.stringify({ minBRL: 7000, maxBRL: 9000, basis: "escopo fixo" }),
    },
    assessment: {
        id: "assess-001",
        company: "Acme Corp",
        name: "João Silva",
        email: "joao@acme.com",
    },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("contract-engine — generateContract", () => {

    it("returns a stable publicSlug derived from proposalId + version", () => {
        const r1 = generateContract(minInput);
        const r2 = generateContract(minInput);
        expect(r1.publicSlug).toBe(r2.publicSlug);
        expect(r1.publicSlug).toMatch(/^ctr-[a-f0-9]{12}$/);
    });

    it("slug changes when proposal version changes", () => {
        const v2 = { ...minInput, proposal: { ...minInput.proposal, version: 2 } };
        expect(generateContract(minInput).publicSlug).not.toBe(generateContract(v2).publicSlug);
    });

    it("produced htmlBody is valid HTML and contains key parties", () => {
        const { htmlBody } = generateContract(minInput);
        expect(htmlBody).toContain("<!DOCTYPE html>");
        expect(htmlBody).toContain("Acme Corp");
        expect(htmlBody).toContain("João Silva");
        expect(htmlBody).toContain("joao@acme.com");
        expect(htmlBody).toContain("InovaCortex"); // default orgName
    });

    it("customOrgName appears in htmlBody", () => {
        const input = { ...minInput, orgName: "MegaAgência" };
        const { htmlBody } = generateContract(input);
        expect(htmlBody).toContain("MegaAgência");
    });

    it("excluded modules (included=false) are NOT rendered in HTML", () => {
        const { htmlBody } = generateContract(minInput);
        expect(htmlBody).toContain("Agente de Triagem");
        expect(htmlBody).toContain("Integração CRM");
        expect(htmlBody).not.toContain("Módulo Inativo");
    });

    it("totalWeeks = sum of included module weeks + 2", () => {
        // modules: 2 + 1 included = 3 weeks + 2 = 5 weeks
        const { htmlBody } = generateContract(minInput);
        expect(htmlBody).toContain("5 semanas");
    });

    it("pricing range appears in htmlBody", () => {
        const { htmlBody } = generateContract(minInput);
        // BRL formatting: R$ 7.000 and R$ 9.000
        expect(htmlBody).toMatch(/R\$\s*7/);
        expect(htmlBody).toMatch(/R\$\s*9/);
    });

    it("summaryBullets array has 6 entries", () => {
        const { summaryBullets } = generateContract(minInput);
        expect(summaryBullets).toHaveLength(6);
    });

    it("summaryBullets[0] contains company and name", () => {
        const { summaryBullets } = generateContract(minInput);
        expect(summaryBullets[0]).toContain("Acme Corp");
        expect(summaryBullets[0]).toContain("João Silva");
    });

    it("summaryBullets[1] lists only included module titles", () => {
        const { summaryBullets } = generateContract(minInput);
        expect(summaryBullets[1]).toContain("Agente de Triagem");
        expect(summaryBullets[1]).toContain("Integração CRM");
        expect(summaryBullets[1]).not.toContain("Módulo Inativo");
    });

    it("handles empty modules JSON gracefully", () => {
        const input = { ...minInput, proposal: { ...minInput.proposal, modules: "[]" } };
        const { htmlBody, summaryBullets } = generateContract(input);
        expect(htmlBody).toContain("Acme Corp"); // still renders
        // totalWeeks = 0 + 2 = 2
        expect(htmlBody).toContain("2 semanas");
        expect(summaryBullets[1]).toContain("0 módulo(s)");
    });

    it("handles malformed modules JSON by defaulting to empty []", () => {
        const input = { ...minInput, proposal: { ...minInput.proposal, modules: "INVALID{JSON" } };
        // Should not throw
        expect(() => generateContract(input)).not.toThrow();
        const { htmlBody } = generateContract(input);
        expect(htmlBody).toContain("Acme Corp");
    });

    it("handles malformed pricingEstimate JSON by defaulting to 0 values", () => {
        const input = { ...minInput, proposal: { ...minInput.proposal, pricingEstimate: "BAD" } };
        expect(() => generateContract(input)).not.toThrow();
    });

    it("includes phone in CONTRATANTE block when provided", () => {
        const input = { ...minInput, assessment: { ...minInput.assessment, phone: "+55 11 99999-1234" } };
        const { htmlBody } = generateContract(input);
        expect(htmlBody).toContain("+55 11 99999-1234");
    });

    it("omits phone br tag when phone is null", () => {
        // null phone → no extra <br>+phone in CONTRATANTE block
        const input = { ...minInput, assessment: { ...minInput.assessment, phone: null } };
        const { htmlBody } = generateContract(input);
        expect(htmlBody).not.toContain("+55"); // just making sure
        expect(htmlBody).toContain("joao@acme.com"); // email still there
    });

    it("Anexo A table contains all included module titles", () => {
        const { htmlBody } = generateContract(minInput);
        expect(htmlBody).toContain("Anexo A");
        expect(htmlBody).toContain("Agente de Triagem");
        expect(htmlBody).toContain("Integração CRM");
    });

    it("Anexo B shows correct number of modules and investment range", () => {
        const { htmlBody } = generateContract(minInput);
        expect(htmlBody).toContain("Anexo B");
        expect(htmlBody).toContain("2 Módulos");
    });

    it("contains electronic signature disclaimer text", () => {
        const { htmlBody } = generateContract(minInput);
        expect(htmlBody).toContain("Assinatura Eletrônica");
        expect(htmlBody).toContain("MP 2.200-2");
    });

    it("contains LGPD clause", () => {
        const { htmlBody } = generateContract(minInput);
        expect(htmlBody).toContain("LGPD");
        expect(htmlBody).toContain("13.709");
    });

    it("contains 7-day cancellation clause", () => {
        const { htmlBody } = generateContract(minInput);
        expect(htmlBody).toContain("7 dias");
    });
});
