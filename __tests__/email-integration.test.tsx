/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { EmailIntegrationsClient } from "../app/org/[slug]/admin/email/email-integrations-client";

const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mockRefresh }),
}));

type FetchResponse = {
    ok: boolean;
    status?: number;
    json: () => Promise<unknown>;
};

function mockJsonResponse(payload: unknown, ok = true, status = 200): FetchResponse {
    return {
        ok,
        status,
        json: () => Promise.resolve(payload),
    };
}

describe("OPT-1 Unified Inbox - Email Integrations UI", () => {
    const assignMock = jest.fn();

    beforeEach(() => {
        assignMock.mockClear();
        mockRefresh.mockClear();
        global.fetch = jest.fn();
    });

    it("renders offline state when no integration exists", () => {
        render(
            <EmailIntegrationsClient
                orgSlug="test-org"
                initialIntegration={null}
                providerAvailability={{ google: true, microsoft: false }}
                onAuthorizationUrl={assignMock}
            />,
        );

        expect(screen.getByText(/Inbox Offline/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Conectar Google Workspace/i })).toBeInTheDocument();
    });

    it("renders connected state with sync freshness metadata", () => {
        render(
            <EmailIntegrationsClient
                orgSlug="test-org"
                initialIntegration={{
                    id: "1",
                    status: "connected",
                    provider: "google",
                    ownerEmail: "admin@inovacortex.com.br",
                    expiryAt: null,
                    lastSyncAt: "2026-03-18T10:00:00.000Z",
                    lastSyncStatus: "success",
                    lastSyncDurationMs: 1200,
                    lastError: null,
                    updatedAt: "2026-03-18T10:00:00.000Z",
                }}
                providerAvailability={{ google: true, microsoft: true }}
                onAuthorizationUrl={assignMock}
            />,
        );

        expect(screen.getByText(/Inbox Integrada/i)).toBeInTheDocument();
        expect(screen.getByText(/admin@inovacortex.com.br/i)).toBeInTheDocument();
        expect(screen.getByText(/Sincronizado/i)).toBeInTheDocument();
        expect(screen.getByText(/1\.2s/i)).toBeInTheDocument();
        expect(screen.getByText(/sync automático continua rodando em segundo plano/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Desconectar Inbox/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Atualizar agora/i })).toBeInTheDocument();
    });

    it("revalidates lightly when the tab regains focus", () => {
        render(
            <EmailIntegrationsClient
                orgSlug="test-org"
                initialIntegration={{
                    id: "1",
                    status: "connected",
                    provider: "google",
                    ownerEmail: "admin@inovacortex.com.br",
                    expiryAt: null,
                    lastSyncAt: "2026-03-18T10:00:00.000Z",
                    lastSyncStatus: "success",
                    lastSyncDurationMs: 1200,
                    lastError: null,
                    updatedAt: "2026-03-18T10:00:00.000Z",
                }}
                providerAvailability={{ google: true, microsoft: true }}
                onAuthorizationUrl={assignMock}
            />,
        );

        fireEvent.focus(window);

        expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it("calls connect API route on connect button click", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce(
            mockJsonResponse({
                success: true,
                data: {
                    authorizationUrl: "https://accounts.google.com/o/oauth2/auth?code=123",
                    provider: "google",
                },
            }),
        );

        render(
            <EmailIntegrationsClient
                orgSlug="test-org"
                initialIntegration={null}
                providerAvailability={{ google: true, microsoft: false }}
                onAuthorizationUrl={assignMock}
            />,
        );

        await user.click(screen.getByRole("button", { name: /Conectar Google Workspace/i }));

        expect(global.fetch).toHaveBeenCalledWith("/api/org/test-org/email/connect", expect.objectContaining({
            method: "POST",
        }));
        expect(assignMock).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/auth?code=123");
    });

    it("disables the refresh button while manual sync is in progress and updates state locally", async () => {
        const user = userEvent.setup();
        let resolveFetch!: (value: FetchResponse) => void;
        const pendingFetch = new Promise<FetchResponse>((resolve) => {
            resolveFetch = resolve;
        });

        (global.fetch as jest.Mock).mockReturnValueOnce(pendingFetch);

        render(
            <EmailIntegrationsClient
                orgSlug="test-org"
                initialIntegration={{
                    id: "1",
                    status: "connected",
                    provider: "google",
                    ownerEmail: "admin@inovacortex.com.br",
                    expiryAt: null,
                    lastSyncAt: "2026-03-18T10:00:00.000Z",
                    lastSyncStatus: "failed",
                    lastSyncDurationMs: 500,
                    lastError: "Timeout while syncing",
                    updatedAt: "2026-03-18T10:00:00.000Z",
                }}
                providerAvailability={{ google: true, microsoft: true }}
                onAuthorizationUrl={assignMock}
            />,
        );

        const refreshButton = screen.getByRole("button", { name: /Atualizar agora/i });
        await user.click(refreshButton);

        expect(refreshButton).toBeDisabled();
        expect(global.fetch).toHaveBeenCalledWith("/api/org/test-org/email/refresh", expect.objectContaining({
            method: "POST",
        }));

        resolveFetch(
            mockJsonResponse({
                success: true,
                data: {
                    result: {
                        organizationId: "org-1",
                        provider: "google",
                        syncedThreads: 1,
                        syncedMessages: 2,
                        matchedContacts: 1,
                        linkedDeals: 0,
                        skipped: false,
                        lastSyncAt: "2026-03-18T12:00:00.000Z",
                        lastSyncStatus: "success",
                        lastSyncDurationMs: 800,
                    },
                    integration: {
                        id: "1",
                        status: "connected",
                        provider: "google",
                        ownerEmail: "admin@inovacortex.com.br",
                        expiryAt: null,
                        lastSyncAt: "2026-03-18T12:00:00.000Z",
                        lastSyncStatus: "success",
                        lastSyncDurationMs: 800,
                        lastError: null,
                        updatedAt: "2026-03-18T12:00:00.000Z",
                    },
                },
            }),
        );

        await waitFor(() => {
            expect(screen.getByText(/Sincronizado/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/800ms/i)).toBeInTheDocument();
    });

    it("shows a safe operational error when manual refresh fails", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce(
            mockJsonResponse({
                success: false,
                error: "EMAIL_SYNC_IN_PROGRESS",
                message: "A sincronização já está em andamento.",
            }, false, 409),
        );

        render(
            <EmailIntegrationsClient
                orgSlug="test-org"
                initialIntegration={{
                    id: "1",
                    status: "connected",
                    provider: "google",
                    ownerEmail: "admin@inovacortex.com.br",
                    expiryAt: null,
                    lastSyncAt: "2026-03-18T10:00:00.000Z",
                    lastSyncStatus: "failed",
                    lastSyncDurationMs: 500,
                    lastError: "Timeout while syncing",
                    updatedAt: "2026-03-18T10:00:00.000Z",
                }}
                providerAvailability={{ google: true, microsoft: true }}
                onAuthorizationUrl={assignMock}
            />,
        );

        await user.click(screen.getByRole("button", { name: /Atualizar agora/i }));

        await waitFor(() => {
            expect(screen.getByText(/A sincronização já está em andamento\./i)).toBeInTheDocument();
        });
    });

    it("calls disconnect API route on disconnect button click", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce(
            mockJsonResponse({
                success: true,
                data: {
                    integration: null,
                },
            }),
        );

        render(
            <EmailIntegrationsClient
                orgSlug="test-org"
                initialIntegration={{
                    id: "1",
                    status: "connected",
                    provider: "google",
                    ownerEmail: "admin@inovacortex.com.br",
                    expiryAt: null,
                    lastSyncAt: "2026-03-18T10:00:00.000Z",
                    lastSyncStatus: "success",
                    lastSyncDurationMs: 1200,
                    lastError: null,
                    updatedAt: "2026-03-18T10:00:00.000Z",
                }}
                providerAvailability={{ google: true, microsoft: false }}
                onAuthorizationUrl={assignMock}
            />,
        );

        await user.click(screen.getByRole("button", { name: /Desconectar Inbox/i }));

        expect(global.fetch).toHaveBeenCalledWith("/api/org/test-org/email/disconnect", expect.objectContaining({
            method: "POST",
        }));
        await waitFor(() => {
            expect(screen.getByText(/Inbox Offline/i)).toBeInTheDocument();
        });
    });
});
