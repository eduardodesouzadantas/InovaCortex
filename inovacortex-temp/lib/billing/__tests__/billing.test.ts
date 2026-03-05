import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Prisma and logger ───────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
    prisma: {
        billingRecord: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
        auditEvent: {
            create: vi.fn().mockResolvedValue({}),
        },
    },
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { createCheckoutForProposal, CheckoutOptions } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const opts: CheckoutOptions = {
    amountCents: 500000,
    currency: "BRL",
    description: "Implementação IA — Agente de Triagem",
    orgSlug: "inovacortex",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("billing — createCheckoutForProposal (STUB mode, no STRIPE_SECRET_KEY)", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.STRIPE_SECRET_KEY;
        // Default: no existing billing record
        (prisma as any).billingRecord.findUnique.mockResolvedValue(null);
        (prisma as any).billingRecord.upsert.mockImplementation(({ create }: any) =>
            Promise.resolve(create)
        );
    });

    it("returns stub=true when STRIPE_SECRET_KEY is not set", async () => {
        const result = await createCheckoutForProposal("org-1", "prop-abc", opts);
        expect(result.stub).toBe(true);
    });

    it("checkoutUrl contains the orgSlug and proposalId in stub mode", async () => {
        const result = await createCheckoutForProposal("org-1", "prop-abc", opts);
        expect(result.checkoutUrl).toContain("inovacortex");
        expect(result.checkoutUrl).toContain("prop-abc");
        expect(result.checkoutUrl).toContain("/billing/stub/");
    });

    it("sessionId starts with 'stub_' in stub mode", async () => {
        const result = await createCheckoutForProposal("org-1", "prop-abc", opts);
        expect(result.sessionId).toMatch(/^stub_/);
    });

    it("sessionId embeds the proposalId prefix in stub mode", async () => {
        const result = await createCheckoutForProposal("org-1", "prop-abc-123", opts);
        expect(result.sessionId).toContain("prop-abc"); // first 8 chars of proposalId
    });

    it("calls prisma.billingRecord.upsert with correct amount in stub mode", async () => {
        await createCheckoutForProposal("org-1", "prop-xyz", opts);
        const upsertCall = (prisma as any).billingRecord.upsert.mock.calls[0][0];
        expect(upsertCall.create.amountCents).toBe(500000);
        expect(upsertCall.create.currency).toBe("BRL");
        expect(upsertCall.create.status).toBe("pending");
    });

    it("is idempotent — returns existing record if checkoutUrl already exists", async () => {
        const existing = {
            id: "br-1",
            stripeCheckoutSessionId: "stub_existing",
            checkoutUrl: "http://localhost:3000/org/inovacortex/billing/stub/prop-existing",
        };
        (prisma as any).billingRecord.findUnique.mockResolvedValue(existing);

        const result = await createCheckoutForProposal("org-1", "prop-existing", opts);
        // Should return existing without calling upsert
        expect(result.checkoutUrl).toBe(existing.checkoutUrl);
        expect((prisma as any).billingRecord.upsert).not.toHaveBeenCalled();
    });

    it("idempotent result from existing stub record has stub=true", async () => {
        const existing = {
            id: "br-2",
            stripeCheckoutSessionId: "stub_old",
            checkoutUrl: "http://localhost:3000/org/x/billing/stub/p1",
        };
        (prisma as any).billingRecord.findUnique.mockResolvedValue(existing);
        const result = await createCheckoutForProposal("org-1", "p1", opts);
        expect(result.stub).toBe(true);
    });

    it("idempotent result from existing real-Stripe record has stub=false", async () => {
        const existing = {
            id: "br-3",
            stripeCheckoutSessionId: "cs_live_real123",
            checkoutUrl: "https://checkout.stripe.com/pay/cs_live_real123",
        };
        (prisma as any).billingRecord.findUnique.mockResolvedValue(existing);
        const result = await createCheckoutForProposal("org-1", "p2", opts);
        expect(result.stub).toBe(false);
    });

    it("uses NEXT_PUBLIC_BASE_URL if set for checkoutUrl construction", async () => {
        process.env.NEXT_PUBLIC_BASE_URL = "https://app.inovacortex.com";
        const result = await createCheckoutForProposal("org-2", "prop-base", opts);
        expect(result.checkoutUrl).toContain("https://app.inovacortex.com");
        delete process.env.NEXT_PUBLIC_BASE_URL;
    });

    it("defaults to localhost:3000 when NEXT_PUBLIC_BASE_URL is not set", async () => {
        delete process.env.NEXT_PUBLIC_BASE_URL;
        const result = await createCheckoutForProposal("org-2", "prop-local", opts);
        expect(result.checkoutUrl).toContain("localhost:3000");
    });

    it("upsert create.orgId matches parameter", async () => {
        await createCheckoutForProposal("my-org-999", "prop-y", opts);
        const upsertCall = (prisma as any).billingRecord.upsert.mock.calls[0][0];
        expect(upsertCall.create.orgId).toBe("my-org-999");
    });

    it("upsert create.proposalId matches parameter", async () => {
        await createCheckoutForProposal("org-x", "my-proposal-888", opts);
        const upsertCall = (prisma as any).billingRecord.upsert.mock.calls[0][0];
        expect(upsertCall.create.proposalId).toBe("my-proposal-888");
    });
});
