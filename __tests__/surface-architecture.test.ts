import {
    buildAgencySurfaceDefinition,
    buildTenantExecutiveSurfaceDefinition,
    buildTenantOperatorSurfaceDefinition,
} from "../lib/front/surface-architecture";

describe("Front surface architecture", () => {
    test("keeps agency split between operating system and platform control", () => {
        const surface = buildAgencySurfaceDefinition();

        expect(surface.kind).toBe("agency");
        expect(surface.description).toContain("governa a plataforma");
        expect(surface.sections.map((section) => section.id)).toEqual([
            "agency-ops",
            "agency-control",
        ]);
        expect(surface.sections[0].description).toContain("agenda");
        expect(surface.sections[1].description).toContain("rollout");
        expect(surface.sections[0].items.some((item) => item.href === "/agency/commercial/leads")).toBe(true);
        expect(surface.sections[1].items.some((item) => item.href === "/agency/monitoring")).toBe(true);
        expect(surface.sections[1].items.some((item) => item.href === "/agency/organizations")).toBe(true);
    });

    test("keeps operator and CEO surfaces semantically distinct", () => {
        const operator = buildTenantOperatorSurfaceDefinition({
            slug: "acme",
            canAccessExecutive: true,
        });
        const ceo = buildTenantExecutiveSurfaceDefinition("acme");

        expect(operator.kind).toBe("operator");
        expect(operator.description).toContain("agir no dia");
        expect(operator.sections[0].description).toContain("agora");
        expect(operator.sections.some((section) => section.items.some((item) => item.href === "/org/acme/admin/crm"))).toBe(true);
        expect(operator.sections.some((section) => section.items.some((item) => item.href === "/org/acme/admin/whatsapp"))).toBe(true);
        expect(operator.sections.some((section) => section.items.some((item) => item.href === "/org/acme/admin/webhooks"))).toBe(true);
        expect(operator.crossLinks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ href: "/org/acme/executive" }),
            ]),
        );

        expect(ceo.kind).toBe("ceo");
        expect(ceo.sections[0].items.some((item) => item.href === "/org/acme/executive#alerts")).toBe(true);
        expect(ceo.crossLinks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ href: "/org/acme/admin" }),
            ]),
        );
    });

    test("does not expose CEO bridge to non-executive operator roles", () => {
        const operator = buildTenantOperatorSurfaceDefinition({
            slug: "acme",
            canAccessExecutive: false,
        });

        expect(operator.crossLinks).toHaveLength(0);
    });
});
