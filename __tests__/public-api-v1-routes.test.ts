const mockAuthenticateAndRateLimitPublicApiRequest = jest.fn();
const mockListPublicContacts = jest.fn();
const mockCreatePublicContact = jest.fn();
const mockListPublicDeals = jest.fn();
const mockCreatePublicDeal = jest.fn();
const mockListPublicActivities = jest.fn();
const mockCreatePublicActivity = jest.fn();
const mockListPublicConversations = jest.fn();
const mockGetPublicExecutivePulse = jest.fn();
const mockBeginPublicApiIdempotency = jest.fn();
const mockFinalizePublicApiIdempotencySuccess = jest.fn();
const mockFinalizePublicApiIdempotencyError = jest.fn();

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock("../lib/public-api/v1-auth", () => {
    const actual = jest.requireActual("../lib/public-api/v1-auth");
    return {
        ...actual,
        authenticateAndRateLimitPublicApiRequest: mockAuthenticateAndRateLimitPublicApiRequest,
    };
});

jest.mock("../lib/public-api/v1-idempotency", () => {
    const actual = jest.requireActual("../lib/public-api/v1-idempotency");
    return {
        ...actual,
        beginPublicApiIdempotency: mockBeginPublicApiIdempotency,
        finalizePublicApiIdempotencySuccess: mockFinalizePublicApiIdempotencySuccess,
        finalizePublicApiIdempotencyError: mockFinalizePublicApiIdempotencyError,
    };
});

jest.mock("../lib/public-api/v1-service", () => ({
    listPublicContacts: mockListPublicContacts,
    createPublicContact: mockCreatePublicContact,
    listPublicDeals: mockListPublicDeals,
    createPublicDeal: mockCreatePublicDeal,
    listPublicActivities: mockListPublicActivities,
    createPublicActivity: mockCreatePublicActivity,
    listPublicConversations: mockListPublicConversations,
    getPublicExecutivePulse: mockGetPublicExecutivePulse,
}));

import { GET as contactsGET, POST as contactsPOST } from "../app/api/public/v1/contacts/route";
import { GET as dealsGET, POST as dealsPOST } from "../app/api/public/v1/deals/route";
import { GET as activitiesGET, POST as activitiesPOST } from "../app/api/public/v1/activities/route";
import { GET as conversationsGET } from "../app/api/public/v1/conversations/route";
import { GET as pulseGET } from "../app/api/public/v1/executive/pulse/route";
import { GET as rootGET } from "../app/api/public/v1/route";

describe("public api v1 routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthenticateAndRateLimitPublicApiRequest.mockImplementation(async (_request: Request, input: { limit?: number }) => ({
            context: {
                organizationId: "org-1",
                organizationSlug: "acme",
                organizationName: "Acme",
                apiKeyId: "key-1",
                apiKeyName: "Primary",
                apiKeyPrefix: "icx_pub_123",
            },
            rateLimit: {
                limit: input.limit ?? 120,
                remaining: (input.limit ?? 120) - 1,
                resetAt: new Date("2026-03-18T12:01:00.000Z"),
            },
        }));
        mockBeginPublicApiIdempotency.mockResolvedValue({ kind: "skipped" });
    });

    it("returns the API discovery payload in the public envelope", async () => {
        const response = await rootGET(new Request("http://localhost/api/public/v1", {
            headers: {
                "x-request-id": "req_root",
                Authorization: "Bearer token",
            },
        })) as Response;

        expect(response.status).toBe(200);
        expect(response.headers.get("x-request-id")).toBe("req_root");
        expect(response.headers.get("x-ratelimit-limit")).toBe("120");
        await expect(response.json()).resolves.toMatchObject({
            data: {
                version: "v1",
                organization: {
                    slug: "acme",
                },
                availableResources: expect.arrayContaining([
                    expect.objectContaining({ path: "/api/public/v1/contacts" }),
                ]),
            },
            meta: {
                requestId: "req_root",
                version: "v1",
            },
            error: null,
        });
    });

    it("lists contacts with cursor pagination and envelope metadata", async () => {
        mockListPublicContacts.mockResolvedValueOnce({
            items: [],
            pagination: {
                limit: 10,
                total: 0,
                returnedCount: 0,
                hasNextPage: false,
                nextCursor: null,
            },
        });

        const response = await contactsGET(new Request("http://localhost/api/public/v1/contacts?cursor=eyJvZmZzZXQiOjEwfQ&limit=10", {
            headers: {
                "x-request-id": "req_contacts",
                Authorization: "Bearer token",
            },
        })) as Response;

        expect(mockListPublicContacts).toHaveBeenCalledWith({
            organizationId: "org-1",
            offset: 10,
            limit: 10,
        });
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            data: [],
            meta: {
                requestId: "req_contacts",
                version: "v1",
                pagination: {
                    limit: 10,
                    total: 0,
                    returnedCount: 0,
                    hasNextPage: false,
                    nextCursor: null,
                },
            },
            error: null,
        });
    });

    it("creates contacts with idempotency support", async () => {
        mockBeginPublicApiIdempotency.mockResolvedValueOnce({
            kind: "claimed",
            recordId: "idem-contact-1",
            requestHash: "hash-1",
        });
        mockCreatePublicContact.mockResolvedValueOnce({
            id: "contact-1",
            name: "Ana",
            email: "ana@acme.com",
            phoneNumberE164: "5511999998888",
            lifecycle: "lead",
            tags: [],
            lastMessageAt: null,
            createdAt: "2026-03-18T00:00:00.000Z",
            updatedAt: "2026-03-18T00:00:00.000Z",
        });

        const response = await contactsPOST(new Request("http://localhost/api/public/v1/contacts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": "idem-contact-1",
                "x-request-id": "req_contact_post",
                Authorization: "Bearer token",
            },
            body: JSON.stringify({ phoneNumberE164: "+55 11 99999-8888", name: "Ana" }),
        })) as Response;

        expect(mockCreatePublicContact).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-1",
            phoneNumberE164: "5511999998888",
            name: "Ana",
        }));
        expect(mockFinalizePublicApiIdempotencySuccess).toHaveBeenCalledWith(expect.objectContaining({
            recordId: "idem-contact-1",
            responseStatus: 201,
        }));
        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toMatchObject({
            data: {
                phoneNumberE164: "5511999998888",
            },
            meta: {
                requestId: "req_contact_post",
                version: "v1",
            },
            error: null,
        });
    });

    it("replays stored idempotent contact responses", async () => {
        mockBeginPublicApiIdempotency.mockResolvedValueOnce({
            kind: "replay",
            replay: {
                kind: "success",
                responseStatus: 201,
                data: {
                    id: "contact-1",
                    name: "Ana",
                    email: "ana@acme.com",
                    phoneNumberE164: "5511999998888",
                    lifecycle: "lead",
                    tags: [],
                    lastMessageAt: null,
                    createdAt: "2026-03-18T00:00:00.000Z",
                    updatedAt: "2026-03-18T00:00:00.000Z",
                },
            },
        });

        const response = await contactsPOST(new Request("http://localhost/api/public/v1/contacts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": "idem-contact-1",
                "x-request-id": "req_contact_replay",
                Authorization: "Bearer token",
            },
            body: JSON.stringify({ phoneNumberE164: "+55 11 99999-8888", name: "Ana" }),
        })) as Response;

        expect(mockCreatePublicContact).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
            data: {
                id: "contact-1",
            },
            meta: {
                requestId: "req_contact_replay",
                version: "v1",
            },
            error: null,
        });
    });

    it("lists deals and activities without leaking tenant context", async () => {
        mockListPublicDeals.mockResolvedValueOnce({
            items: [],
            pagination: {
                limit: 25,
                total: 0,
                returnedCount: 0,
                hasNextPage: false,
                nextCursor: null,
            },
        });
        mockCreatePublicDeal.mockResolvedValueOnce({
            created: true,
            deal: {
                id: "deal-1",
                contactId: "contact-1",
                contact: {
                    id: "contact-1",
                    name: "Ana",
                    email: "ana@acme.com",
                    phoneNumberE164: "5511999998888",
                    lifecycle: "lead",
                    tags: [],
                },
                stage: {
                    id: "stage-1",
                    name: "Novo",
                    pipelineId: "pipeline-1",
                },
                value: 25000,
                status: "open",
                activityCount: 0,
                createdAt: "2026-03-18T00:00:00.000Z",
            },
        });
        mockListPublicActivities.mockResolvedValueOnce({
            items: [],
            pagination: {
                limit: 25,
                total: 0,
                returnedCount: 0,
                hasNextPage: false,
                nextCursor: null,
            },
        });
        mockCreatePublicActivity.mockResolvedValueOnce({
            id: "activity-1",
            dealId: "deal-1",
            type: "call_attempt",
            note: "Follow-up",
            createdAt: "2026-03-18T00:00:00.000Z",
            deal: {
                id: "deal-1",
                status: "open",
                value: 25000,
                contact: {
                    id: "contact-1",
                    name: "Ana",
                    email: "ana@acme.com",
                    phoneNumberE164: "5511999998888",
                },
                stage: {
                    id: "stage-1",
                    name: "Novo",
                },
            },
        });
        mockListPublicConversations.mockResolvedValueOnce({
            items: [],
            pagination: {
                limit: 25,
                total: 0,
                returnedCount: 0,
                hasNextPage: false,
                nextCursor: null,
            },
            summary: { total: 0, whatsapp: 0, email: 0 },
        });
        mockGetPublicExecutivePulse.mockResolvedValueOnce({
            org: {
                id: "org-1",
                slug: "acme",
                name: "Acme",
                plan: "growth",
            },
            generatedAt: "2026-03-18T00:00:00.000Z",
            hasData: true,
            emptyReason: null,
            overview: {
                headline: "Pulse",
                subheadline: "Resumo",
            },
            prioritizedAlerts: [],
            decisionNarrative: {
                tone: "neutral",
                summary: "Resumo",
                stateOfPlay: "Estado",
                biggestRisk: "Risco",
                biggestOpportunity: "Oportunidade",
                focusNow: [],
            },
            warnings: [],
        });

        const dealsListResponse = await dealsGET(new Request("http://localhost/api/public/v1/deals", {
            headers: {
                "x-request-id": "req_deals",
                Authorization: "Bearer token",
            },
        })) as Response;
        expect(dealsListResponse.status).toBe(200);

        const dealsCreateResponse = await dealsPOST(new Request("http://localhost/api/public/v1/deals", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": "idem-deal-1",
                "x-request-id": "req_deal_post",
                Authorization: "Bearer token",
            },
            body: JSON.stringify({ contactId: "contact-1", value: 25000 }),
        })) as Response;
        expect(dealsCreateResponse.status).toBe(201);

        const activitiesListResponse = await activitiesGET(new Request("http://localhost/api/public/v1/activities?dealId=deal-1", {
            headers: {
                "x-request-id": "req_activities",
                Authorization: "Bearer token",
            },
        })) as Response;
        expect(activitiesListResponse.status).toBe(200);

        const activitiesCreateResponse = await activitiesPOST(new Request("http://localhost/api/public/v1/activities", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": "idem-activity-1",
                "x-request-id": "req_activity_post",
                Authorization: "Bearer token",
            },
            body: JSON.stringify({ dealId: "deal-1", type: "call_attempt", note: "Follow-up" }),
        })) as Response;
        expect(activitiesCreateResponse.status).toBe(201);

        const conversationsResponse = await conversationsGET(new Request("http://localhost/api/public/v1/conversations?limit=10", {
            headers: {
                "x-request-id": "req_conversations",
                Authorization: "Bearer token",
            },
        })) as Response;
        expect(conversationsResponse.status).toBe(200);

        const pulseResponse = await pulseGET(new Request("http://localhost/api/public/v1/executive/pulse", {
            headers: {
                "x-request-id": "req_pulse",
                Authorization: "Bearer token",
            },
        })) as Response;
        expect(pulseResponse.status).toBe(200);

        expect(mockGetPublicExecutivePulse).toHaveBeenCalledWith({ organizationSlug: "acme" });
    });

    it("surfaces route validation without bypassing the request wrapper", async () => {
        mockAuthenticateAndRateLimitPublicApiRequest.mockRejectedValueOnce(new Error("boom"));

        const response = await conversationsGET(new Request("http://localhost/api/public/v1/conversations", {
            headers: {
                "x-request-id": "req_error",
                Authorization: "Bearer token",
            },
        })) as Response;

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toMatchObject({
            data: null,
            meta: {
                requestId: "req_error",
                version: "v1",
            },
            error: {
                code: "internal_error",
            },
        });
    });
});
