/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("next/link", () => {
    const ReactModule = jest.requireActual<typeof import("react")>("react");
    return {
        __esModule: true,
        default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
            ReactModule.createElement("a", { href, ...props }, children),
    };
});

const push = jest.fn();
const refresh = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push,
        refresh,
    }),
}));

import { AcessoClient } from "../app/acesso/acesso-client";

describe("AcessoClient", () => {
    beforeEach(() => {
        push.mockReset();
        refresh.mockReset();
        global.fetch = jest.fn();
    });

    it("renders distinct agency and company entry points", () => {
        render(<AcessoClient preferredEntry="company" />);

        expect(screen.getByRole("heading", { name: "Entrar como Agência" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Entrar como Empresa" })).toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: "Entrar na Agência" })[0]).toHaveAttribute("href", "/agency/login");
        expect(screen.getByRole("link", { name: "Entrar como Empresa" })).toHaveAttribute("href", "/acesso?perfil=empresa");
    });

    it("authenticates the company flow and redirects to the tenant console", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                orgSlug: "acme",
                role: "admin",
            }),
        });

        render(<AcessoClient preferredEntry="company" />);

        await user.type(screen.getByLabelText("E-mail"), "admin@acme.com");
        await user.type(screen.getByLabelText("Senha"), "secret123");
        await user.click(screen.getByRole("button", { name: "Entrar na Empresa" }));

        await waitFor(() => {
            expect(push).toHaveBeenCalledWith("/org/acme/admin");
        });
        expect(refresh).toHaveBeenCalled();
    });

    it("shows a safe error when company login fails", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            json: async () => ({
                success: false,
                error: "INVALID_CREDENTIALS",
                code: "UNAUTHORIZED",
            }),
        });

        render(<AcessoClient preferredEntry="company" />);

        await user.type(screen.getByLabelText("E-mail"), "admin@acme.com");
        await user.type(screen.getByLabelText("Senha"), "wrongpass");
        await user.click(screen.getByRole("button", { name: "Entrar na Empresa" }));

        expect(await screen.findByText("Credenciais invalidas")).toBeInTheDocument();
    });
});
