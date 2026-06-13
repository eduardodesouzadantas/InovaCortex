/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = jest.fn();
const refresh = jest.fn();

jest.mock("next/link", () => {
    const ReactModule = jest.requireActual<typeof import("react")>("react");
    return {
        __esModule: true,
        default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
            ReactModule.createElement("a", { href, ...props }, children),
    };
});

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push,
        refresh,
    }),
}));

import { EmpresaLoginClient } from "../app/empresa/login/empresa-login-client";

describe("EmpresaLoginClient", () => {
    beforeEach(() => {
        push.mockReset();
        refresh.mockReset();
        global.fetch = jest.fn();
    });

    it("renders a direct company login surface", () => {
        render(<EmpresaLoginClient continueHref="/org/acme/admin" />);

        expect(screen.getByText("Acesso da Empresa")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Fazer Avaliacao" })).toHaveAttribute("href", "/avaliacao");
        expect(screen.getByRole("link", { name: "/agency/login" })).toHaveAttribute("href", "/agency/login");
        expect(screen.getByRole("link", { name: "Continuar para minha area" })).toHaveAttribute("href", "/org/acme/admin");
    });

    it("shows the invite success banner and pre-fills the email", () => {
        render(<EmpresaLoginClient continueHref={null} inviteSuccess initialEmail="invitee@acme.com" />);

        expect(screen.getByText("Seu acesso foi ativado com sucesso.")).toBeInTheDocument();
        expect(screen.getByText("Agora voce pode entrar com seu e-mail e senha.")).toBeInTheDocument();
        expect(screen.getByDisplayValue("invitee@acme.com")).toBeInTheDocument();
    });

    it("authenticates and redirects to the tenant console", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                orgSlug: "acme",
                role: "admin",
            }),
        });

        render(<EmpresaLoginClient continueHref={null} />);

        await user.type(screen.getByPlaceholderText("voce@empresa.com"), "admin@acme.com");
        await user.type(screen.getByPlaceholderText("********"), "secret123");
        await user.click(screen.getByRole("button", { name: "Entrar na Empresa" }));

        await waitFor(() => {
            expect(push).toHaveBeenCalledWith("/org/acme/admin");
        });
        expect(refresh).toHaveBeenCalled();
    });

    it("shows a temporary block message on 429", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: async () => ({
                success: false,
                code: "TOO_MANY_REQUESTS",
                error: "TOO_MANY_ATTEMPTS",
            }),
        });

        render(<EmpresaLoginClient continueHref={null} />);

        await user.type(screen.getByPlaceholderText("voce@empresa.com"), "admin@acme.com");
        await user.type(screen.getByPlaceholderText("********"), "secret123");
        await user.click(screen.getByRole("button", { name: "Entrar na Empresa" }));

        expect(await screen.findByText("Muitas tentativas. Tente novamente em alguns minutos.")).toBeInTheDocument();
    });
});
