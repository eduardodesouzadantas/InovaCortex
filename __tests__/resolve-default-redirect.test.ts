jest.mock("../lib/auth/session", () => ({
    getAuthContext: jest.fn(),
    isAuthContextSplitEnabled: jest.fn(() => false),
}));

jest.mock("../lib/auth/rbac", () => ({
    hasAuthScope: jest.fn(() => false),
}));

import { resolveDefaultRedirect } from "../lib/auth/resolveDefaultRedirect";
import { getAuthContext } from "../lib/auth/session";

const getAuthContextMock = getAuthContext as jest.MockedFunction<typeof getAuthContext>;

describe("resolveDefaultRedirect", () => {
    it("routes unauthenticated users to the access hub", async () => {
        getAuthContextMock.mockResolvedValueOnce({
            isAuthenticated: false,
        } as never);

        await expect(resolveDefaultRedirect()).resolves.toBe("/acesso");
    });
});
