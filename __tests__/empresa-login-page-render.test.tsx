jest.mock("next/link", () => {
    const ReactModule = jest.requireActual<typeof import("react")>("react");
    return {
        __esModule: true,
        default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
            ReactModule.createElement("a", { href, ...props }, children),
    };
});

const getAuthContextMock = jest.fn();
const resolveDefaultRedirectMock = jest.fn();
const pushMock = jest.fn();
const refreshMock = jest.fn();

jest.mock("../lib/auth/session", () => ({
    getAuthContext: getAuthContextMock,
}));

jest.mock("../lib/auth/resolveDefaultRedirect", () => ({
    resolveDefaultRedirect: resolveDefaultRedirectMock,
}));

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: pushMock,
        refresh: refreshMock,
    }),
}));

import { renderToStaticMarkup } from "react-dom/server";

import EmpresaLoginPage from "../app/empresa/login/page";

describe("EmpresaLoginPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("passes invite success state to the login client", async () => {
        getAuthContextMock.mockResolvedValue({
            isAuthenticated: false,
        });

        const element = await EmpresaLoginPage({
            searchParams: Promise.resolve({
                invite: "accepted",
                email: "invitee@acme.com",
            }),
        });
        const html = renderToStaticMarkup(element as React.ReactElement);

        expect(html).toContain("Seu acesso foi ativado com sucesso.");
        expect(html).toContain("invitee@acme.com");
        expect(resolveDefaultRedirectMock).not.toHaveBeenCalled();
    });
});
