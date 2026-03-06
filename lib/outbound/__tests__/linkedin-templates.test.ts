/**
 * lib/outbound/__tests__/linkedin-templates.test.ts
 * V21: Unit tests for linkedin-templates pure functions.
 * Zero deps — vitest-safe.
 */

import { describe, it, expect } from "vitest";
import {
    detectICP, renderTemplate, nextStage, buildTemplateKey,
    STAGE_ORDER, STAGE_COOLDOWNS,
    type ICP, type Stage,
} from "../linkedin-templates";

const ctx = {
    firstName: "Ana",
    company: "Imóveis Prime",
    title: "Diretora Comercial",
};

describe("detectICP", () => {
    it("detects imobiliaria", () => {
        expect(detectICP("imobiliaria", "Diretor Comercial")).toBe("imobiliaria");
    });
    it("detects clinica", () => {
        expect(detectICP("saúde", "Diretora Clínica")).toBe("clinica");
    });
    it("detects consultoria", () => {
        expect(detectICP("consultoria", "Sócio")).toBe("consultoria");
    });
    it("falls back to servicos_recorrentes", () => {
        expect(detectICP("unknown industry", "CEO")).toBe("servicos_recorrentes");
    });
});

describe("buildTemplateKey", () => {
    it("imobiliaria + connect_note → imobiliaria_connect", () => {
        expect(buildTemplateKey("imobiliaria", "connect_note")).toBe("imobiliaria_connect");
    });
    it("clinica + dm1 → clinica_dm1", () => {
        expect(buildTemplateKey("clinica", "dm1")).toBe("clinica_dm1");
    });
    it("servicos_recorrentes + close → servicos_close", () => {
        expect(buildTemplateKey("servicos_recorrentes", "close")).toBe("servicos_close");
    });
});

describe("renderTemplate", () => {
    const icps: ICP[] = ["imobiliaria", "clinica", "consultoria", "servicos_recorrentes"];
    const stages: Stage[] = ["connect_note", "dm1", "dm2", "dm3", "close"];

    for (const icp of icps) {
        for (const stage of stages) {
            it(`renders ${icp} × ${stage} (non-empty)`, () => {
                const { body, key } = renderTemplate(icp, stage, ctx);
                expect(body.length).toBeGreaterThan(20);
                expect(key.length).toBeGreaterThan(0);
            });
        }
    }

    it("injects firstName", () => {
        const { body } = renderTemplate("imobiliaria", "dm1", ctx);
        expect(body).toContain("Ana");
    });

    it("injects company in dm1", () => {
        const { body } = renderTemplate("imobiliaria", "dm1", ctx);
        expect(body).toContain("Imóveis Prime");
    });

    it("connect_note ≤ 250 chars", () => {
        const { body } = renderTemplate("imobiliaria", "connect_note", ctx);
        expect(body.length).toBeLessThanOrEqual(250);
    });

    it("dm3 includes dealLink when provided", () => {
        const { body } = renderTemplate("clinica", "dm3", { ...ctx, dealLink: "https://inovacortex.com.br/deal/abc123" });
        expect(body).toContain("https://inovacortex.com.br/deal/abc123");
    });

    it("close includes calLink when provided", () => {
        const { body } = renderTemplate("consultoria", "close", { ...ctx, calLink: "https://calendly.com/test" });
        expect(body).toContain("https://calendly.com/test");
    });

    it("dm2 includes proof stat when provided", () => {
        const { body } = renderTemplate("servicos_recorrentes", "dm2", { ...ctx, proofStat: "payback médio de 5 meses" });
        expect(body).toContain("payback médio de 5 meses");
    });

    it("no buzzwords in any template", () => {
        const buzzwords = ["revolucionári", "disruptiv", "game-changer", "viravirou"];
        for (const icp of icps) {
            for (const stage of stages) {
                const { body } = renderTemplate(icp, stage, ctx);
                for (const bw of buzzwords) {
                    expect(body.toLowerCase()).not.toContain(bw);
                }
            }
        }
    });
});

describe("nextStage", () => {
    it("connect_note → dm1", () => { expect(nextStage("connect_note")).toBe("dm1"); });
    it("dm1 → dm2", () => { expect(nextStage("dm1")).toBe("dm2"); });
    it("dm2 → dm3", () => { expect(nextStage("dm2")).toBe("dm3"); });
    it("dm3 → close", () => { expect(nextStage("dm3")).toBe("close"); });
    it("close → done", () => { expect(nextStage("close")).toBe("done"); });
});

describe("STAGE_COOLDOWNS", () => {
    it("connect_note cooldown is 24h in ms", () => {
        expect(STAGE_COOLDOWNS["connect_note"]).toBe(24 * 60 * 60 * 1000);
    });
    it("dm1 cooldown is 72h", () => {
        expect(STAGE_COOLDOWNS["dm1"]).toBe(72 * 60 * 60 * 1000);
    });
    it("dm2 cooldown is 96h", () => {
        expect(STAGE_COOLDOWNS["dm2"]).toBe(96 * 60 * 60 * 1000);
    });
    it("dm3 cooldown is 72h", () => {
        expect(STAGE_COOLDOWNS["dm3"]).toBe(72 * 60 * 60 * 1000);
    });
});
