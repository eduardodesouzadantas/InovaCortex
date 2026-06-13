import { generateWebhookSecret, isTransientWebhookDeliveryFailure, signWebhookPayload, verifyWebhookPayloadSignature } from "../lib/public-api/webhook-signature";

describe("webhook signature helpers", () => {
    it("signs and verifies webhook payloads", () => {
        const secret = generateWebhookSecret();
        const timestamp = "1710763200";
        const payload = JSON.stringify({ id: "evt_1", type: "deal.updated" });
        const signature = signWebhookPayload(secret, timestamp, payload);

        expect(signature).toMatch(/^v1=/);
        expect(verifyWebhookPayloadSignature(secret, timestamp, payload, signature)).toBe(true);
        expect(verifyWebhookPayloadSignature(secret, timestamp, payload, "v1=deadbeef")).toBe(false);
    });

    it("treats transient delivery failures as retryable", () => {
        expect(isTransientWebhookDeliveryFailure(408)).toBe(true);
        expect(isTransientWebhookDeliveryFailure(429)).toBe(true);
        expect(isTransientWebhookDeliveryFailure(500)).toBe(true);
        expect(isTransientWebhookDeliveryFailure(400)).toBe(false);
    });
});

