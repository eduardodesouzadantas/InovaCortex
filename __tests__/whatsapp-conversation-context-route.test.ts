const requireOrgContextMock = jest.fn();
const getConversationCommercialContextMock = jest.fn();

jest.mock("../lib/auth/org-context", () => ({
    requireOrgContext: requireOrgContextMock,
}));

jest.mock("../lib/whatsapp/conversation-service", () => ({
    getConversationCommercialContext: getConversationCommercialContextMock,
}));

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { GET } from "../app/api/org/[slug]/whatsapp/conversations/[id]/context/route";

describe("WhatsApp conversation context route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("returns tenant-safe commercial context for an allowed conversation", async () => {
        requireOrgContextMock.mockResolvedValue({
            orgId: "org-a",
            role: "closer",
            userId: "user-1",
        });
        getConversationCommercialContextMock.mockResolvedValue({
            conversationId: "conversation-1",
            contact: {
                id: "contact-1",
                name: "Maria",
                phoneNumberE164: "5511999999999",
                lifecycle: "lead",
                tags: [],
                waId: "5511999999999",
            },
            attention: {
                label: "Resposta pendente",
                detail: "1 mensagem aguardando retorno.",
                tone: "warning",
            },
            record: null,
            recommendations: [],
            recentEvents: [],
            quickActions: [],
        });

        const response = await GET(
            new Request("http://localhost/api/org/acme/whatsapp/conversations/conversation-1/context") as any,
            { params: Promise.resolve({ slug: "acme", id: "conversation-1" }) },
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                conversationId: "conversation-1",
            },
        });
        expect(getConversationCommercialContextMock).toHaveBeenCalledWith({
            organizationId: "org-a",
            orgSlug: "acme",
            role: "closer",
            userId: "user-1",
            conversationId: "conversation-1",
        });
    });

    test("maps forbidden conversation access to tenant-safe response", async () => {
        requireOrgContextMock.mockResolvedValue({
            orgId: "org-a",
            role: "closer",
            userId: "user-1",
        });
        getConversationCommercialContextMock.mockRejectedValue(new Error("FORBIDDEN: closer requires assignment"));

        const response = await GET(
            new Request("http://localhost/api/org/acme/whatsapp/conversations/conversation-1/context") as any,
            { params: Promise.resolve({ slug: "acme", id: "conversation-1" }) },
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "FORBIDDEN",
        });
    });
});
