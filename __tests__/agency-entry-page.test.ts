const getAuthContextMock = jest.fn();
const redirectMock = jest.fn();

jest.mock("../lib/auth/session", () => ({
    getAuthContext: getAuthContextMock,
}));

jest.mock("next/navigation", () => ({
    redirect: redirectMock,
}));

import AgencyEntryPage from "../app/agency/page";

describe("Agency entry page", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("redirects agency users to the canonical agency dashboard", async () => {
        getAuthContextMock.mockResolvedValue({
            isAuthenticated: true,
            authScope: "agency",
        });

        await AgencyEntryPage();

        expect(redirectMock).toHaveBeenCalledWith("/agency/dashboard");
    });

    test("redirects unauthenticated users to agency login", async () => {
        getAuthContextMock.mockResolvedValue({
            isAuthenticated: false,
            authScope: null,
        });

        await AgencyEntryPage();

        expect(redirectMock).toHaveBeenCalledWith("/agency/login");
    });
});
