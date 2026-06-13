import { trackEvent } from "../app/services/identityEvents/identityEvent.service";
import { prisma } from "../lib/prisma";

jest.mock("../lib/prisma", () => ({
    prisma: {
        identityEvent: {
            create: jest.fn(async (args) => ({
                id: "evt_123",
                type: args.data.type,
                userId: args.data.userId,
                organizationId: args.data.organizationId,
                metadata: args.data.metadata,
                createdAt: new Date(),
            })),
        },
    },
}));

describe("identityEvent.service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should successfully track an identity event", async () => {
        const result = await trackEvent({
            type: "LOGIN_SUCCESS",
            userId: "u123",
            organizationId: "org-1",
            metadata: { foo: "bar" },
        });

        expect(prisma.identityEvent.create).toHaveBeenCalledWith({
            data: {
                type: "LOGIN_SUCCESS",
                userId: "u123",
                organizationId: "org-1",
                metadata: '{"foo":"bar"}',
            },
        });
        
        expect(result).toBeDefined();
        if (result) {
            expect(result.type).toBe("LOGIN_SUCCESS");
        }
    });

    it("should catch errors and return null instead of throwing", async () => {
        (prisma.identityEvent.create as jest.Mock).mockRejectedValueOnce(new Error("DB Connection Error"));

        const result = await trackEvent({
            type: "LOGIN_FAILED",
            metadata: { email: "bad@ex.com" },
        });

        expect(result).toBeNull(); // ensures it doesn't throw and crash login
    });
});
