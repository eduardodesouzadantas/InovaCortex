process.env.APP_ENCRYPTION_KEY = "test-email-oauth-key-32chars-long!!!!";

const prismaMock = {
    emailIntegration: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
    },
};

jest.mock("../lib/prisma", () => ({
    prisma: prismaMock,
}));

jest.mock("../lib/onboarding-status", () => ({
    recordOnboardingEmailConnected: jest.fn(async () => undefined),
}));

import { encrypt } from "../lib/security/crypto";
import {
    createEmailOAuthState,
    disconnectEmailIntegration,
    parseEmailOAuthConnectInput,
    parseEmailOAuthState,
    saveEmailOAuthIntegration,
} from "../lib/integrations/email-oauth";

describe("Email OAuth service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("creates and parses signed OAuth state", () => {
        const state = createEmailOAuthState({
            organizationId: "org-1",
            organizationSlug: "acme",
            userId: "user-1",
            provider: "google",
        });

        const parsed = parseEmailOAuthState(state);
        expect(parsed).toMatchObject({
            organizationId: "org-1",
            organizationSlug: "acme",
            userId: "user-1",
            provider: "google",
        });
        expect(parsed.issuedAt).toBeTruthy();
    });

    test("rejects tampered OAuth state", () => {
        const state = createEmailOAuthState({
            organizationId: "org-1",
            organizationSlug: "acme",
            userId: "user-1",
            provider: "google",
        });

        const tampered = `${state.slice(0, -2)}aa`;
        expect(() => parseEmailOAuthState(tampered)).toThrow("INVALID_OAUTH_STATE");
    });

    test("defaults the connect payload to Google when provider is omitted", () => {
        expect(parseEmailOAuthConnectInput({})).toEqual({ provider: "google" });
    });

    test("persists OAuth tokens encrypted at rest", async () => {
        prismaMock.emailIntegration.findUnique.mockResolvedValue({
            refreshTokenEncrypted: null,
            accessTokenEncrypted: null,
        });
        prismaMock.emailIntegration.upsert.mockResolvedValue({
            id: "integration-1",
            provider: "google",
            status: "connected",
            ownerEmail: "admin@example.com",
            expiryAt: new Date("2026-03-18T10:00:00.000Z"),
            lastSyncAt: new Date("2026-03-18T10:00:00.000Z"),
            lastSyncStatus: "success",
            lastSyncDurationMs: 1200,
            lastError: null,
            updatedAt: new Date("2026-03-18T10:00:00.000Z"),
        });

        await saveEmailOAuthIntegration("org-1", {
            provider: "google",
            ownerEmail: "admin@example.com",
            accessToken: "access-token",
            refreshToken: "refresh-token",
            expiryAt: new Date("2026-03-19T10:00:00.000Z"),
        });

        expect(prismaMock.emailIntegration.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { organizationId: "org-1" },
            create: expect.objectContaining({
                accessTokenEncrypted: expect.any(String),
                refreshTokenEncrypted: expect.any(String),
                ownerEmail: "admin@example.com",
                status: "connected",
            }),
            update: expect.objectContaining({
                accessTokenEncrypted: expect.any(String),
                refreshTokenEncrypted: expect.any(String),
                ownerEmail: "admin@example.com",
                status: "connected",
            }),
        }));
    });

    test("disconnects locally and clears stored tokens", async () => {
        const refreshTokenEncrypted = encrypt("refresh-token");
        const accessTokenEncrypted = encrypt("access-token");

        prismaMock.emailIntegration.findUnique.mockResolvedValue({
            provider: "google",
            accessTokenEncrypted,
            refreshTokenEncrypted,
        });
        prismaMock.emailIntegration.update.mockResolvedValue({
            id: "integration-1",
            provider: "google",
            status: "disconnected",
            ownerEmail: "admin@example.com",
            expiryAt: null,
            lastSyncAt: new Date("2026-03-18T10:00:00.000Z"),
            lastSyncStatus: "skipped",
            lastSyncDurationMs: 15,
            lastError: null,
            updatedAt: new Date("2026-03-18T10:00:00.000Z"),
        });
        global.fetch = jest.fn(() => Promise.resolve({ ok: true })) as jest.Mock;

        const result = await disconnectEmailIntegration("org-1");

        expect(global.fetch).toHaveBeenCalledWith(
            "https://oauth2.googleapis.com/revoke",
            expect.objectContaining({
                method: "POST",
            }),
        );
        expect(prismaMock.emailIntegration.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { organizationId: "org-1" },
            data: expect.objectContaining({
                status: "disconnected",
                accessTokenEncrypted: null,
                refreshTokenEncrypted: null,
                expiryAt: null,
            }),
        }));
        expect(result?.status).toBe("disconnected");
    });
});
