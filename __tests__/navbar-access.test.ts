jest.mock("next/link", () => {
    const ReactModule = jest.requireActual<typeof import("react")>("react");
    return {
        __esModule: true,
        default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
            ReactModule.createElement("a", { href, ...props }, children),
    };
});

jest.mock("../components/theme-toggle", () => ({
    ThemeToggle: () => {
        const ReactModule = jest.requireActual<typeof import("react")>("react");
        return ReactModule.createElement("span", { "data-testid": "theme-toggle" }, "Tema");
    },
}));

jest.mock("../lib/auth/resolveDefaultRedirect", () => ({
    resolveDefaultRedirect: jest.fn(async () => "/acesso"),
}));

import { renderToStaticMarkup } from "react-dom/server";

import { Navbar } from "../components/navbar";

describe("Navbar access CTA", () => {
    it("renders the canonical access entry in the header", async () => {
        const html = renderToStaticMarkup(await Navbar());

        expect(html).toContain("Entrar no Império");
        expect(html).toContain('href="/acesso"');
        expect(html).toContain("Fazer Avaliação");
    });
});
