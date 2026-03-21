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
    resolveDefaultRedirect: jest.fn(async () => "/empresa/login"),
}));

import { renderToStaticMarkup } from "react-dom/server";

import { Navbar } from "../components/navbar";
const ReactModule = jest.requireActual<typeof import("react")>("react");

describe("Navbar access CTA", () => {
    it("renders the customer-first access entry in the header", () => {
        const html = renderToStaticMarkup(ReactModule.createElement(Navbar));

        expect(html).toContain("Entrar na Empresa");
        expect(html).toContain('href="/empresa/login"');
        expect(html).toContain("Fazer Avaliação");
    });
});
