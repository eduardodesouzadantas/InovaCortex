const mockTx = {
    executivePulseAction: {
        upsert: jest.fn(),
    },
    auditEvent: {
        create: jest.fn(),
    },
    activity: {
        create: jest.fn(),
    },
};

const mockPrisma = {
    executivePulseAction: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
    },
    deal: {
        findFirst: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
};

jest.mock("../lib/prisma", () => ({
    prisma: mockPrisma,
}));

jest.mock("../lib/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

import { loadExecutivePulseActionStates, recordExecutivePulseAction } from "../lib/executive/pulse-actions";

describe("executive pulse actions", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.executivePulseAction.findMany.mockResolvedValue([]);
        mockPrisma.executivePulseAction.findUnique.mockResolvedValue(null);
        mockPrisma.deal.findFirst.mockResolvedValue(null);
        mockTx.executivePulseAction.upsert.mockResolvedValue({
            pulseKey: "stalled_deal::proposal stale",
            status: "delegated",
            lastActionAt: new Date("2026-03-18T12:00:00.000Z"),
            lastActionBy: "ceo@acme.com",
            linkedEntityType: "deal",
            linkedEntityId: "deal-1",
        });
    });

    it("loads persisted pulse action states by tenant and pulse key", async () => {
        mockPrisma.executivePulseAction.findMany.mockResolvedValueOnce([
            {
                pulseKey: "stalled_deal::proposal stale",
                status: "tracking",
                lastActionAt: new Date("2026-03-18T12:00:00.000Z"),
                lastActionBy: "ceo@acme.com",
                linkedEntityType: "deal",
                linkedEntityId: "deal-1",
            },
        ]);

        const states = await loadExecutivePulseActionStates("org-1", [
            "stalled_deal::proposal stale",
            "revenue_risk::late follow up",
        ]);

        expect(mockPrisma.executivePulseAction.findMany).toHaveBeenCalledWith({
            where: {
                organizationId: "org-1",
                pulseKey: {
                    in: [
                        "stalled_deal::proposal stale",
                        "revenue_risk::late follow up",
                    ],
                },
            },
            select: {
                pulseKey: true,
                status: true,
                lastActionAt: true,
                lastActionBy: true,
                linkedEntityType: true,
                linkedEntityId: true,
            },
        });
        expect(states.get("stalled_deal::proposal stale")).toMatchObject({
            pulseKey: "stalled_deal::proposal stale",
            status: "tracking",
            lastActionBy: "ceo@acme.com",
            linkedEntityId: "deal-1",
        });
    });

    it("records executive action state and links a deal when available", async () => {
        mockPrisma.deal.findFirst.mockResolvedValueOnce({ id: "deal-1" });
        mockTx.executivePulseAction.upsert.mockResolvedValueOnce({
            pulseKey: "stalled_deal::proposal stale",
            status: "resolved",
            lastActionAt: new Date("2026-03-18T12:00:00.000Z"),
            lastActionBy: "ceo@acme.com",
            linkedEntityType: "deal",
            linkedEntityId: "deal-1",
        });

        const state = await recordExecutivePulseAction({
            organizationId: "org-1",
            pulseKey: "stalled_deal::proposal stale",
            status: "resolved",
            lastActionBy: "ceo@acme.com",
            linkedEntityType: "deal",
            linkedEntityId: "deal-1",
        });

        expect(mockPrisma.deal.findFirst).toHaveBeenCalledWith({
            where: {
                id: "deal-1",
                organizationId: "org-1",
            },
            select: {
                id: true,
            },
        });
        expect(mockTx.executivePulseAction.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                organizationId_pulseKey: {
                    organizationId: "org-1",
                    pulseKey: "stalled_deal::proposal stale",
                },
            },
            update: expect.objectContaining({
                status: "resolved",
                linkedEntityType: "deal",
                linkedEntityId: "deal-1",
                lastActionBy: "ceo@acme.com",
            }),
        }));
        expect(mockTx.activity.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                organizationId: "org-1",
                dealId: "deal-1",
                type: "executive_pulse_action",
            }),
        }));
        expect(mockTx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                organizationId: "org-1",
                action: "executivePulse:resolved",
            }),
        }));
        expect(state).toMatchObject({
            pulseKey: "stalled_deal::proposal stale",
            status: "resolved",
            lastActionBy: "ceo@acme.com",
            linkedEntityId: "deal-1",
        });
    });

    it("keeps tenant isolation when a linked deal is outside the org", async () => {
        mockPrisma.deal.findFirst.mockResolvedValueOnce(null);
        mockTx.executivePulseAction.upsert.mockResolvedValueOnce({
            pulseKey: "revenue_risk::late follow up",
            status: "tracking",
            lastActionAt: new Date("2026-03-18T12:00:00.000Z"),
            lastActionBy: "ceo@acme.com",
            linkedEntityType: "contact",
            linkedEntityId: "contact-1",
        });

        await recordExecutivePulseAction({
            organizationId: "org-1",
            pulseKey: "revenue_risk::late follow up",
            status: "tracking",
            lastActionBy: "ceo@acme.com",
            linkedEntityType: "contact",
            linkedEntityId: "contact-1",
        });

        expect(mockPrisma.deal.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                contactId: "contact-1",
                organizationId: "org-1",
                status: {
                    notIn: ["closed_won", "closed_lost", "archived"],
                },
            },
        }));
        expect(mockTx.activity.create).not.toHaveBeenCalled();
    });
});
