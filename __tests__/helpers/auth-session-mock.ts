export function createAuthSessionMock() {
    return {
        getAgencyOrgSlug: jest.fn(() => "inovacortex"),
        hashPassword: jest.fn(),
        verifyPassword: jest.fn(),
        setSessionCookie: jest.fn(),
        resolveAuthContext: jest.fn(),
    };
}
