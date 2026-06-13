import { createMobileActivity, updateMobileDeal } from "@/lib/mobile/mobile-actions";

const emitWebhookEvent = jest.fn();

jest.mock("@/lib/public-api/webhooks", () => ({
    emitWebhookEvent: (...args: unknown[]) => emitWebhookEvent(...args),
}));

jest.mock("@/lib/prisma", () => ({
    prisma: {
        organization: {
            findUnique: jest.fn(),
        },
        emailThread: {
            findFirst: jest.fn(),
        },
        deal: {
            findFirst: jest.fn(),
            update: jest.fn(),
        },
        activity: {
            create: jest.fn(),
        },
    },
}));

const { prisma: mockPrisma } = jest.requireMock("@/lib/prisma") as {
    prisma: {
        organization: {
            findUnique: jest.Mock;
        };
        emailThread: {
            findFirst: jest.Mock;
        };
        deal: {
            findFirst: jest.Mock;
            update: jest.Mock;
        };
        activity: {
            create: jest.Mock;
        };
    };
};

describe("mobile actions", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.organization.findUnique.mockResolvedValue({ subscriptionStatus: "trial" });
    });

    it("updates a deal and emits a webhook event", async () => {
        mockPrisma.deal.findFirst.mockResolvedValue({ id: "deal-1" });
        mockPrisma.deal.update.mockResolvedValue({
            id: "deal-1",
            contactId: "con-1",
            contact: {
                id: "con-1",
                name: "Ana",
                email: "ana@example.com",
                phoneNumberE164: "+5511999999999",
                lifecycle: "lead",
                tags: JSON.stringify(["vip"]),
            },
            stage: {
                id: "stage-1",
                name: "Proposta",
                pipelineId: "pipe-1",
            },
            value: 12000,
            status: "closed_won",
            createdAt: new Date("2026-03-18T11:00:00.000Z"),
            _count: { activities: 3 },
        });
        mockPrisma.activity.create.mockResolvedValue({
            id: "act-note-1",
            dealId: "deal-1",
            type: "mobile_note",
            note: "Fechado no mobile",
            createdAt: new Date("2026-03-18T12:05:00.000Z"),
            deal: {
                id: "deal-1",
                status: "closed_won",
                value: 12000,
                contact: {
                    id: "con-1",
                    name: "Ana",
                    email: "ana@example.com",
                    phoneNumberE164: "+5511999999999",
                },
                stage: {
                    id: "stage-1",
                    name: "Proposta",
                },
            },
        });

        const result = await updateMobileDeal({
            organizationId: "org-1",
            userId: "user-1",
            role: "admin",
            dealId: "deal-1",
            status: "closed_won",
            note: "Fechado no mobile",
        });

        expect(result.noteSaved).toBe(true);
        expect(mockPrisma.activity.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                type: "mobile_note",
            }),
        }));
        expect(emitWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: "deal.updated",
        }));
    });

    it("creates an activity from an email thread target", async () => {
        mockPrisma.emailThread.findFirst.mockResolvedValue({
            dealId: "deal-2",
            contactId: "con-2",
        });
        mockPrisma.deal.findFirst.mockResolvedValue({
            id: "deal-2",
        });
        mockPrisma.activity.create.mockResolvedValue({
            id: "act-1",
            dealId: "deal-2",
            type: "email_follow_up",
            note: "Follow up",
            createdAt: new Date("2026-03-18T12:00:00.000Z"),
            deal: {
                id: "deal-2",
                status: "open",
                value: 12000,
                contact: {
                    id: "con-2",
                    name: "Bea",
                    email: "bea@example.com",
                    phoneNumberE164: "+5511888888888",
                },
                stage: {
                    id: "stage-2",
                    name: "Contato",
                },
            },
        });

        const result = await createMobileActivity({
            organizationId: "org-1",
            userId: "user-1",
            role: "admin",
            threadId: "email-thread-1",
            type: "email_follow_up",
            note: "Follow up",
        });

        expect(result.activity.id).toBe("act-1");
        expect(emitWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: "activity.created",
        }));
    });

    it("blocks mobile updates when billing is suspended", async () => {
        mockPrisma.organization.findUnique.mockResolvedValueOnce({ subscriptionStatus: "suspended" });

        await expect(updateMobileDeal({
            organizationId: "org-1",
            userId: "user-1",
            role: "admin",
            dealId: "deal-1",
            status: "open",
        })).rejects.toMatchObject({
            status: 403,
            code: "FORBIDDEN",
        });
    });
});
