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
});
