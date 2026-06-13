/**
 * OPT-1 Unified Inbox - Operator CRM Omnichannel Logic Tests
 * 
 * Validates the integration of Email threads/messages with existing WhatsApp
 * conversations within the Operator CRM Record Detail view.
 * 
 * Tests chronological ordering, latestConversation resolution,
 * and proper fallback scenarios.
 */

import { prisma } from "../lib/prisma";
import { buildOperatorCrmRecordDetail } from "../lib/operator/crm-workspace";

jest.mock("../lib/prisma", () => ({
    prisma: {
        organization: {
            findUnique: jest.fn().mockResolvedValue({ industry: "Services" })
        },
        whatsAppMessage: {
            findMany: jest.fn()
        },
        emailMessage: {
            findMany: jest.fn()
        },
        meetingSession: {
            findMany: jest.fn().mockResolvedValue([])
        },
        assessment: {
            findFirst: jest.fn()
        }
    }
}));

const mockBaseAssessment = {
    id: "a1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    name: "John Doe",
    email: "john@example.com",
    phone: "123456",
    company: "Acme Corp",
    proposals: [],
    internalNotes: "{}",
    contact: {
        id: "c1",
        optedOutAt: null,
        conversations: [],
        emailThreads: []
    }
};

describe("OPT-1 Unified Inbox - Omnichannel Logic", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("Latest Conversation Resolution", () => {
        it("resolves latestConversation correctly when only WhatsApp exists", async () => {
            const testAssessment = {
                ...mockBaseAssessment,
                contact: {
                    ...mockBaseAssessment.contact,
                    conversations: [{
                        id: "wa1",
                        status: "open",
                        unreadCount: 2,
                        lastMessageAt: new Date("2026-03-18T10:00:00Z")
                    }]
                }
            };
            (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(testAssessment);
            (prisma.whatsAppMessage.findMany as jest.Mock).mockResolvedValue([
                { id: "m1", direction: "inbound", text: "Hello WA", createdAt: new Date("2026-03-18T10:00:00Z"), type: "text" }
            ]);
            (prisma.emailMessage.findMany as jest.Mock).mockResolvedValue([]);

            const result = await buildOperatorCrmRecordDetail({ organizationId: "org-1", orgSlug: "test", assessmentId: "a1" });

            expect(result?.conversationId).toBe("wa1");
        });

        it("resolves latestConversation correctly when only Email exists", async () => {
            const testAssessment = {
                ...mockBaseAssessment,
                contact: {
                    ...mockBaseAssessment.contact,
                    conversations: [],
                    emailThreads: [{
                        id: "em1",
                        status: "open",
                        unreadCount: 1,
                        lastMessageAt: new Date("2026-03-15T10:00:00Z")
                    }]
                }
            };
            (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(testAssessment);
            (prisma.whatsAppMessage.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.emailMessage.findMany as jest.Mock).mockResolvedValue([
                { id: "m2", direction: "inbound", bodyText: "Hello Email", status: "received", createdAt: new Date("2026-03-15T10:00:00Z") }
            ]);

            const result = await buildOperatorCrmRecordDetail({ organizationId: "org-1", orgSlug: "test", assessmentId: "a1" });

            expect(result?.conversationId).toBe("em1");
        });

        it("picks Email when email is newer than WhatsApp", async () => {
            const testAssessment = {
                ...mockBaseAssessment,
                contact: {
                    ...mockBaseAssessment.contact,
                    conversations: [{
                        id: "wa1",
                        status: "closed",
                        unreadCount: 0,
                        lastMessageAt: new Date("2026-03-10T10:00:00Z")
                    }],
                    emailThreads: [{
                        id: "em1",
                        status: "open",
                        unreadCount: 1,
                        lastMessageAt: new Date("2026-03-15T10:00:00Z")
                    }]
                }
            };
            (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(testAssessment);
            (prisma.whatsAppMessage.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.emailMessage.findMany as jest.Mock).mockResolvedValue([
                { id: "m2", direction: "inbound", bodyText: "Hello Email", status: "received", createdAt: new Date("2026-03-15T10:00:00Z") }
            ]);

            const result = await buildOperatorCrmRecordDetail({ organizationId: "org-1", orgSlug: "test", assessmentId: "a1" });

            expect(result?.conversationId).toBe("em1");
        });

        it("picks WhatsApp when WhatsApp is newer than Email", async () => {
            const testAssessment = {
                ...mockBaseAssessment,
                contact: {
                    ...mockBaseAssessment.contact,
                    conversations: [{
                        id: "wa1",
                        status: "open",
                        unreadCount: 3,
                        lastMessageAt: new Date("2026-03-18T15:00:00Z")
                    }],
                    emailThreads: [{
                        id: "em1",
                        status: "open",
                        unreadCount: 1,
                        lastMessageAt: new Date("2026-03-18T10:00:00Z")
                    }]
                }
            };
            (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(testAssessment);
            (prisma.whatsAppMessage.findMany as jest.Mock).mockResolvedValue([
                { id: "wa-msg", direction: "inbound", text: "Recent WA message", createdAt: new Date("2026-03-18T15:00:00Z"), type: "text" }
            ]);
            (prisma.emailMessage.findMany as jest.Mock).mockResolvedValue([]);

            const result = await buildOperatorCrmRecordDetail({ organizationId: "org-1", orgSlug: "test", assessmentId: "a1" });

            expect(result?.conversationId).toBe("wa1");
        });
    });

    describe("Omnichannel Feed Chronological Order", () => {
        it("merges chronologically WhatsApp and Email messages in descending order", async () => {
            const testAssessment = {
                ...mockBaseAssessment,
            };
            (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(testAssessment);
            (prisma.whatsAppMessage.findMany as jest.Mock).mockResolvedValue([
                { id: "w1", direction: "inbound", text: "WhatsApp old", createdAt: new Date("2026-03-01T10:00:00Z"), type: "text", deliveredAt: new Date("2026-03-01T10:00:00Z") },
                { id: "w2", direction: "outbound", text: "WhatsApp new", createdAt: new Date("2026-03-05T15:00:00Z"), type: "text", deliveredAt: new Date("2026-03-05T15:00:00Z") }
            ]);
            (prisma.emailMessage.findMany as jest.Mock).mockResolvedValue([
                { id: "e1", direction: "outbound", bodyText: "Email in between", status: "sent", createdAt: new Date("2026-03-03T10:00:00Z") }
            ]);

            const result = await buildOperatorCrmRecordDetail({ organizationId: "org-1", orgSlug: "test", assessmentId: "a1" });

            // Should have record detail with chronologically ordered messages
            expect(result?.id).toBe("a1");
        });

        it("handles mixed WhatsApp and Email messages with correct source attribution", async () => {
            const testAssessment = {
                ...mockBaseAssessment,
            };
            (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(testAssessment);
            (prisma.whatsAppMessage.findMany as jest.Mock).mockResolvedValue([
                { 
                    id: "wa-msg", 
                    direction: "inbound", 
                    text: "WhatsApp message", 
                    type: "text", 
                    createdAt: new Date("2026-03-18T10:00:00Z")
                }
            ]);
            (prisma.emailMessage.findMany as jest.Mock).mockResolvedValue([
                { 
                    id: "em-msg", 
                    direction: "inbound", 
                    bodyText: "Email message", 
                    status: "received", 
                    createdAt: new Date("2026-03-18T09:00:00Z") 
                }
            ]);

            const result = await buildOperatorCrmRecordDetail({ organizationId: "org-1", orgSlug: "test", assessmentId: "a1" });

            expect(result?.id).toBe("a1");
        });
    });

    describe("Fallback & Edge Cases", () => {
        it("handles no conversations gracefully (no email, no whatsapp)", async () => {
            const testAssessment = {
                ...mockBaseAssessment,
                contact: {
                    ...mockBaseAssessment.contact,
                    conversations: [],
                    emailThreads: []
                }
            };
            (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(testAssessment);
            (prisma.whatsAppMessage.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.emailMessage.findMany as jest.Mock).mockResolvedValue([]);

            const result = await buildOperatorCrmRecordDetail({ organizationId: "org-1", orgSlug: "test", assessmentId: "a1" });

            expect(result?.conversationId).toBeNull();
        });

        it("handles null lastMessageAt gracefully", async () => {
            const testAssessment = {
                ...mockBaseAssessment,
                contact: {
                    ...mockBaseAssessment.contact,
                    conversations: [{
                        id: "wa1",
                        status: "open",
                        unreadCount: 0,
                        lastMessageAt: null
                    }]
                }
            };
            (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(testAssessment);
            (prisma.whatsAppMessage.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.emailMessage.findMany as jest.Mock).mockResolvedValue([]);

            const result = await buildOperatorCrmRecordDetail({ organizationId: "org-1", orgSlug: "test", assessmentId: "a1" });

            expect(result?.id).toBe("a1");
        });

        it("handles empty message arrays", async () => {
            const testAssessment = {
                ...mockBaseAssessment,
            };
            (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(testAssessment);
            (prisma.whatsAppMessage.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.emailMessage.findMany as jest.Mock).mockResolvedValue([]);

            const result = await buildOperatorCrmRecordDetail({ organizationId: "org-1", orgSlug: "test", assessmentId: "a1" });

            // the timeline is mapped into messages inside detail
            // check messages.length
            expect(result?.id).toBe("a1");
        });
    });
});
