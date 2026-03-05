/**
 * __tests__/content-engine.test.ts
 * R2: Content Engine — pure logic tests.
 * No DB or AI calls — tests prompt structure, status flow, and data helpers.
 */

// ─── Status lifecycle ─────────────────────────────────────────────────────────

describe("ContentEngine: Status lifecycle", () => {
    const FLOW = ["draft", "reviewed", "approved", "scheduled", "posted"] as const;

    test("status flow has 5 stages in correct order", () => {
        expect(FLOW).toHaveLength(5);
        expect(FLOW[0]).toBe("draft");
        expect(FLOW[4]).toBe("posted");
    });

    test("cannot skip from draft to approved directly (guard logic)", () => {
        // Simulates the PATCH guard: posting requires approved status
        function canPost(currentStatus: string): boolean {
            return currentStatus === "approved";
        }
        expect(canPost("draft")).toBe(false);
        expect(canPost("reviewed")).toBe(false);
        expect(canPost("approved")).toBe(true);
    });

    test("each status has a defined next action", () => {
        const NEXT_STATUS: Record<string, string> = {
            draft: "reviewed",
            reviewed: "approved",
            approved: "posted",
        };
        expect(NEXT_STATUS["draft"]).toBe("reviewed");
        expect(NEXT_STATUS["reviewed"]).toBe("approved");
        expect(NEXT_STATUS["approved"]).toBe("posted");
        expect(NEXT_STATUS["posted"]).toBeUndefined();
    });
});

// ─── Content Types ────────────────────────────────────────────────────────────

describe("ContentEngine: Content types", () => {
    const VALID_TYPES = ["linkedin", "instagram", "case_breakdown", "authority_thread", "video_script"];

    test("all 5 content types defined", () => {
        expect(VALID_TYPES).toHaveLength(5);
    });

    test("each type has unique ID", () => {
        expect(new Set(VALID_TYPES).size).toBe(VALID_TYPES.length);
    });

    test("invalid type is not in valid list", () => {
        expect(VALID_TYPES.includes("tiktok" as any)).toBe(false);
        expect(VALID_TYPES.includes("email" as any)).toBe(false);
    });
});

// ─── Data context builder ─────────────────────────────────────────────────────

describe("ContentEngine: Data context strategy", () => {
    function hasRealData(assessment: any, roi: any): boolean {
        return !!(assessment || roi);
    }

    function getContextStrategy(assessment: any, roi: any): "real" | "generic" {
        return hasRealData(assessment, roi) ? "real" : "generic";
    }

    test("with assessment → use real data context", () => {
        const a = { company: "Clínica XYZ", teamSize: 30 };
        expect(getContextStrategy(a, null)).toBe("real");
    });

    test("with roi → use real data context", () => {
        const r = { operationalSavingsEstimate: 50000 };
        expect(getContextStrategy(null, r)).toBe("real");
    });

    test("without either → use generic scenario", () => {
        expect(getContextStrategy(null, null)).toBe("generic");
    });
});

// ─── ROI snapshot integrity ───────────────────────────────────────────────────

describe("ContentEngine: ROI snapshot", () => {
    function buildRoiSnapshot(roi: any) {
        if (!roi) return null;
        return {
            operationalSavingsEstimate: roi.operationalSavingsEstimate,
            revenueIncreaseEstimate: roi.revenueIncreaseEstimate,
            monthlyHoursRecovered: roi.monthlyHoursRecovered,
            estimatedPaybackMonths: roi.estimatedPaybackMonths,
            confidenceLevel: roi.confidenceLevel,
        };
    }

    test("snapshot captures all 5 ROI fields", () => {
        const roi = {
            operationalSavingsEstimate: 120000,
            revenueIncreaseEstimate: 60000,
            monthlyHoursRecovered: 80,
            estimatedPaybackMonths: 6,
            confidenceLevel: "Alta",
        };
        const snap = buildRoiSnapshot(roi);
        expect(snap).not.toBeNull();
        expect(Object.keys(snap!)).toHaveLength(5);
        expect(snap!.operationalSavingsEstimate).toBe(120000);
        expect(snap!.confidenceLevel).toBe("Alta");
    });

    test("null ROI returns null snapshot", () => {
        expect(buildRoiSnapshot(null)).toBeNull();
    });
});

// ─── Hashtag parsing ─────────────────────────────────────────────────────────

describe("ContentEngine: Hashtag handling", () => {
    function parseHashtags(raw: string | null): string[] {
        if (!raw) return [];
        try { return JSON.parse(raw); }
        catch { return []; }
    }

    function normalizeHashtag(tag: string): string {
        return tag.startsWith("#") ? tag.slice(1) : tag;
    }

    test("valid JSON array parses correctly", () => {
        const tags = parseHashtags('["automacao", "inovacortex", "ia"]');
        expect(tags).toHaveLength(3);
        expect(tags[0]).toBe("automacao");
    });

    test("null returns empty array", () => {
        expect(parseHashtags(null)).toHaveLength(0);
    });

    test("invalid JSON returns empty array", () => {
        expect(parseHashtags("not-json")).toHaveLength(0);
    });

    test("normalizeHashtag strips leading #", () => {
        expect(normalizeHashtag("#automacao")).toBe("automacao");
        expect(normalizeHashtag("automacao")).toBe("automacao");
    });
});

// ─── Brand voice rules ─────────────────────────────────────────────────────

describe("ContentEngine: Brand voice validation", () => {
    const FORBIDDEN_BUZZWORDS = [
        "revolucionário", "inovador", "disruptivo", "transformacional", "incrível", "surpreendente"
    ];

    function hasForbiddenBuzzwords(text: string): boolean {
        const normalize = (s: string) =>
            s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const normalizedText = normalize(text);
        return FORBIDDEN_BUZZWORDS.some(w => normalizedText.includes(normalize(w)));
    }

    test("clean consultive copy passes brand check", () => {
        const copy = "Em 3 meses, o cliente reduziu R$22.000 por mes em atendimento manual.";
        expect(hasForbiddenBuzzwords(copy)).toBe(false);
    });

    test("copy with buzzword 'disruptivo' fails brand check", () => {
        const copy = "Nossa plataforma disruptivo resolve tudo.";
        expect(hasForbiddenBuzzwords(copy)).toBe(true);
    });

    test("all forbidden buzzwords are lowercase in list", () => {
        for (const w of FORBIDDEN_BUZZWORDS) {
            expect(w).toBe(w.toLowerCase());
        }
    });
});
