/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = jest.fn();
const refresh = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push,
        refresh,
    }),
}));

import AgencyLoginPage from "../app/(agency-public)/agency/login/page";
import { agencyLoginNavigation } from "../app/(agency-public)/agency/login/page";

describe("AgencyLoginPage", () => {
    beforeEach(() => {
        push.mockReset();
        refresh.mockReset();
        global.fetch = jest.fn();
    });

    it("renders the agency login surface and access links", () => {
        render(<AgencyLoginPage />);

        expect(screen.getByText("Acesso da Agencia")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Acesso da empresa" })).toHaveAttribute("href", "/empresa/login");
    });

    it("authenticates and redirects to the agency dashboard", async () => {
        const user = userEvent.setup();
        const goToDashboard = jest.spyOn(agencyLoginNavigation, "goToDashboard").mockImplementation(() => undefined);
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
            }),
        });

        render(<AgencyLoginPage />);

        await user.type(screen.getByPlaceholderText("E-mail de acesso..."), "agency@inovacortex.com");
        await user.type(screen.getByPlaceholderText("Senha de acesso..."), "password123");
        await user.click(screen.getByRole("button", { name: "Autenticar" }));

        await waitFor(() => {
            expect(goToDashboard).toHaveBeenCalled();
        });
        goToDashboard.mockRestore();
    });

    it("displays invalid credentials error on 401", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({
                success: false,
                code: "UNAUTHORIZED",
                error: "INVALID_CREDENTIALS",
            }),
        });

        render(<AgencyLoginPage />);
        await user.type(screen.getByPlaceholderText("E-mail de acesso..."), "agency@inovacortex.com");
        await user.type(screen.getByPlaceholderText("Senha de acesso..."), "wrongpassword");
        await user.click(screen.getByRole("button", { name: "Autenticar" }));

        expect(await screen.findByText("Credenciais invalidas")).toBeInTheDocument();
    });

    it("displays forbidden error on 403 inactive user", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 403,
            json: async () => ({
                success: false,
                code: "FORBIDDEN",
                error: "INACTIVE_USER",
            }),
        });

        render(<AgencyLoginPage />);
        await user.type(screen.getByPlaceholderText("E-mail de acesso..."), "inactive@inovacortex.com");
        await user.type(screen.getByPlaceholderText("Senha de acesso..."), "password123");
        await user.click(screen.getByRole("button", { name: "Autenticar" }));

        expect(await screen.findByText("Acesso proibido para esta conta")).toBeInTheDocument();
    });

    it("displays payload invalid error on 400 bad request", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => ({
                success: false,
                code: "BAD_REQUEST",
                error: "INVALID_PAYLOAD",
            }),
        });

        render(<AgencyLoginPage />);
        await user.type(screen.getByPlaceholderText("E-mail de acesso..."), "agency@inovacortex.com");
        await user.type(screen.getByPlaceholderText("Senha de acesso..."), "password123");
        await user.click(screen.getByRole("button", { name: "Autenticar" }));
        
        expect(await screen.findByText("Preencha todos os campos corretamente.")).toBeInTheDocument();
    });

    it("displays generic error on 500 internal server error", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({
                success: false,
                code: "INTERNAL_ERROR",
                error: "INTERNAL_ERROR",
            }),
        });

        render(<AgencyLoginPage />);
        await user.type(screen.getByPlaceholderText("E-mail de acesso..."), "agency@inovacortex.com");
        await user.type(screen.getByPlaceholderText("Senha de acesso..."), "password123");
        await user.click(screen.getByRole("button", { name: "Autenticar" }));

        expect(await screen.findByText("Ocorreu um erro inesperado. Tente novamente em instantes.")).toBeInTheDocument();
    });

    it("displays rate limit error on 429", async () => {
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

        render(<AgencyLoginPage />);
        await user.type(screen.getByPlaceholderText("E-mail de acesso..."), "agency@inovacortex.com");
        await user.type(screen.getByPlaceholderText("Senha de acesso..."), "password123");
        await user.click(screen.getByRole("button", { name: "Autenticar" }));

        expect(await screen.findByText("Muitas tentativas. Tente novamente em alguns minutos.")).toBeInTheDocument();
    });
});
