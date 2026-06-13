/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import { WebhookAdminClient } from "../app/org/[slug]/admin/webhooks/webhooks-admin-client";

type FetchResponse = {
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
};

function jsonResponse(payload: unknown, ok = true, status = 200): FetchResponse {
    return {
        ok,
        status,
        json: () => Promise.resolve(payload),
    };
}

describe("WebhookAdminClient", () => {
    const confirmMock = jest.spyOn(window, "confirm").mockReturnValue(true);

    beforeEach(() => {
        confirmMock.mockReturnValue(true);
        global.fetch = jest.fn();
    });

    afterAll(() => {
        confirmMock.mockRestore();
    });

    it("renders the tenant webhook list and creation form", () => {
        render(
            <WebhookAdminClient
                orgSlug="acme"
                initialWebhooks={[
                    {
                        id: "wh_1",
                        url: "https://example.com/webhook",
                        isActive: true,
                        subscribedEvents: ["contact.created", "deal.updated"],
                        lastDeliveryAt: "2026-03-18T12:00:00.000Z",
                        lastDeliveryStatus: "delivered",
                        lastDeliveryError: null,
                        deliveryAttemptCount: 2,
                        createdAt: "2026-03-18T11:00:00.000Z",
                        updatedAt: "2026-03-18T12:00:00.000Z",
                        secretConfigured: true,
                    },
                ]}
                supportedEvents={["contact.created", "deal.updated"]}
            />,
        );

        expect(screen.getByText(/Criar webhook por tenant/i)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "https://example.com/webhook" })).toBeInTheDocument();
        expect(screen.getByText("Entregue", { selector: "span" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Criar endpoint/i })).toBeDisabled();
    });

    it("creates a webhook and shows the secret only once", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce(
            jsonResponse({
                success: true,
                webhook: {
                    id: "wh_2",
                    url: "https://partner.example.com/webhooks/inovacortex",
                    isActive: true,
                    subscribedEvents: ["contact.created"],
                    lastDeliveryAt: null,
                    lastDeliveryStatus: null,
                    lastDeliveryError: null,
                    deliveryAttemptCount: 0,
                    createdAt: "2026-03-18T12:00:00.000Z",
                    updatedAt: "2026-03-18T12:00:00.000Z",
                    secretConfigured: true,
                },
                secret: "whsec_created",
            }),
        );

        render(
            <WebhookAdminClient
                orgSlug="acme"
                initialWebhooks={[]}
                supportedEvents={["contact.created", "deal.updated"]}
            />,
        );

        await user.type(screen.getByLabelText(/URL de destino/i), "https://partner.example.com/webhooks/inovacortex");
        await user.click(screen.getByRole("button", { name: /Criar endpoint/i }));

        await waitFor(() => {
            expect(screen.getByText(/Segredo gerado/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/whsec_created/i)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "https://partner.example.com/webhooks/inovacortex" })).toBeInTheDocument();
    });

    it("updates, rotates and removes an endpoint with local state changes", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce(jsonResponse({
                success: true,
                webhook: {
                    id: "wh_1",
                    url: "https://example.com/webhook-updated",
                    isActive: false,
                    subscribedEvents: ["deal.updated"],
                    lastDeliveryAt: "2026-03-18T12:05:00.000Z",
                    lastDeliveryStatus: "failed",
                    lastDeliveryError: "Gateway timeout",
                    deliveryAttemptCount: 3,
                    createdAt: "2026-03-18T11:00:00.000Z",
                    updatedAt: "2026-03-18T12:05:00.000Z",
                    secretConfigured: true,
                },
            }))
            .mockResolvedValueOnce(jsonResponse({
                success: true,
                webhook: {
                    id: "wh_1",
                    url: "https://example.com/webhook-updated",
                    isActive: false,
                    subscribedEvents: ["deal.updated"],
                    lastDeliveryAt: "2026-03-18T12:05:00.000Z",
                    lastDeliveryStatus: "failed",
                    lastDeliveryError: "Gateway timeout",
                    deliveryAttemptCount: 4,
                    createdAt: "2026-03-18T11:00:00.000Z",
                    updatedAt: "2026-03-18T12:10:00.000Z",
                    secretConfigured: true,
                },
                secret: "whsec_rotated",
            }))
            .mockResolvedValueOnce(jsonResponse({ success: true }));

        render(
            <WebhookAdminClient
                orgSlug="acme"
                initialWebhooks={[
                    {
                        id: "wh_1",
                        url: "https://example.com/webhook",
                        isActive: true,
                        subscribedEvents: ["contact.created", "deal.updated"],
                        lastDeliveryAt: "2026-03-18T12:00:00.000Z",
                        lastDeliveryStatus: "delivered",
                        lastDeliveryError: null,
                        deliveryAttemptCount: 2,
                        createdAt: "2026-03-18T11:00:00.000Z",
                        updatedAt: "2026-03-18T12:00:00.000Z",
                        secretConfigured: true,
                    },
                ]}
                supportedEvents={["contact.created", "deal.updated"]}
            />,
        );

        const urlInput = screen.getByDisplayValue("https://example.com/webhook");
        await user.clear(urlInput);
        await user.type(urlInput, "https://example.com/webhook-updated");
        await user.click(screen.getAllByRole("button", { name: /Contato criado/i })[1]);
        await user.click(screen.getByRole("button", { name: /Salvar alteracoes/i }));

        await waitFor(() => {
            expect(screen.getByText(/Webhook atualizado\./i)).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /Rotacionar segredo/i }));
        await waitFor(() => {
            expect(screen.getByText(/whsec_rotated/i)).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /Remover/i }));
        await waitFor(() => {
            expect(screen.queryByText(/https:\/\/example.com\/webhook-updated/i)).not.toBeInTheDocument();
        });
    });

    it("shows a safe operational error when the API rejects a request", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({
            success: false,
            error: "WEBHOOK_URL_INVALID",
            message: "Webhook URL is invalid",
        }, false, 400));

        render(
            <WebhookAdminClient
                orgSlug="acme"
                initialWebhooks={[]}
                supportedEvents={["contact.created", "deal.updated"]}
            />,
        );

        await user.type(screen.getByLabelText(/URL de destino/i), "invalid-url");
        await user.click(screen.getByRole("button", { name: /Contato criado/i }));
        await user.click(screen.getByRole("button", { name: /Criar endpoint/i }));

        await waitFor(() => {
            expect(screen.getByText(/Webhook URL is invalid/i)).toBeInTheDocument();
        });
    });
});
