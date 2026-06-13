const mockIdempotencyCreate = jest.fn();
const mockIdempotencyFindUnique = jest.fn();
const mockIdempotencyUpdate = jest.fn();

jest.mock("../lib/prisma", () => ({
    prisma: {
        publicApiIdempotencyRecord: {
            create: mockIdempotencyCreate,
            findUnique: mockIdempotencyFindUnique,
            update: mockIdempotencyUpdate,
        },
    },
}));

jest.mock("../lib/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

import {
    beginPublicApiIdempotency,
    finalizePublicApiIdempotencyError,
    finalizePublicApiIdempotencySuccess,
    hashPublicApiIdempotencyPayload,
} from "../lib/public-api/v1-idempotency";

describe("public api v1 idempotency", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("claims a fresh request", async () => {
        mockIdempotencyCreate.mockResolvedValueOnce({
            id: "idem-1",
        });

        const result = await beginPublicApiIdempotency({
            organizationId: "org-1",
            routeKey: "public:v1:contacts:post",
            idempotencyKey: "idem-key",
            payload: {
                phoneNumberE164: "+55 11 99999-8888",
            },
        });

        expect(result).toMatchObject({
            kind: "claimed",
            recordId: "idem-1",
        });
    });

    it("replays completed responses for the same key and payload", async () => {
        const payload = {
            phoneNumberE164: "+55 11 99999-8888",
        };
        mockIdempotencyCreate.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "P2002" }));
        mockIdempotencyFindUnique.mockResolvedValueOnce({
            id: "idem-1",
            organizationId: "org-1",
            routeKey: "public:v1:contacts:post",
            idempotencyKey: "idem-key",
            requestHash: hashPublicApiIdempotencyPayload(payload),
            status: "completed",
            responseStatus: 201,
            responseBodyJson: JSON.stringify({ created: true }),
            errorCode: null,
            errorMessage: null,
            errorDetailsJson: null,
        });

        const result = await beginPublicApiIdempotency({
            organizationId: "org-1",
            routeKey: "public:v1:contacts:post",
            idempotencyKey: "idem-key",
            payload,
        });

        expect(result).toMatchObject({
            kind: "replay",
            replay: {
                kind: "success",
                responseStatus: 201,
                data: {
                    created: true,
                },
            },
        });
    });

    it("replays failed responses for the same key and payload", async () => {
        const payload = {
            phoneNumberE164: "+55 11 99999-8888",
        };
        mockIdempotencyCreate.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "P2002" }));
        mockIdempotencyFindUnique.mockResolvedValueOnce({
            id: "idem-2",
            organizationId: "org-1",
            routeKey: "public:v1:contacts:post",
            idempotencyKey: "idem-key",
            requestHash: hashPublicApiIdempotencyPayload(payload),
            status: "failed",
            responseStatus: 400,
            responseBodyJson: null,
            errorCode: "VALIDATION_ERROR",
            errorMessage: "phoneNumberE164 is required.",
            errorDetailsJson: JSON.stringify({
                field: "phoneNumberE164",
            }),
        });

        const result = await beginPublicApiIdempotency({
            organizationId: "org-1",
            routeKey: "public:v1:contacts:post",
            idempotencyKey: "idem-key",
            payload,
        });

        expect(result).toMatchObject({
            kind: "replay",
            replay: {
                kind: "error",
                responseStatus: 400,
                code: "VALIDATION_ERROR",
                message: "phoneNumberE164 is required.",
            },
        });
    });

    it("rejects reuse with a different payload", async () => {
        const payload = {
            phoneNumberE164: "+55 11 98888-7777",
        };
        mockIdempotencyCreate.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "P2002" }));
        mockIdempotencyFindUnique.mockResolvedValueOnce({
            id: "idem-1",
            organizationId: "org-1",
            routeKey: "public:v1:contacts:post",
            idempotencyKey: "idem-key",
            requestHash: hashPublicApiIdempotencyPayload({
                phoneNumberE164: "+55 11 99999-8888",
            }),
            status: "completed",
            responseStatus: 201,
            responseBodyJson: JSON.stringify({ created: true }),
            errorCode: null,
            errorMessage: null,
            errorDetailsJson: null,
        });

        await expect(beginPublicApiIdempotency({
            organizationId: "org-1",
            routeKey: "public:v1:contacts:post",
            idempotencyKey: "idem-key",
            payload,
        })).rejects.toMatchObject({
            status: 409,
            code: "CONFLICT",
        });
    });

    it("finalizes success and error state", async () => {
        mockIdempotencyUpdate.mockResolvedValueOnce({});
        mockIdempotencyUpdate.mockResolvedValueOnce({});

        await finalizePublicApiIdempotencySuccess({
            recordId: "idem-1",
            responseStatus: 201,
            data: {
                created: true,
            },
        });

        await finalizePublicApiIdempotencyError({
            recordId: "idem-1",
            responseStatus: 400,
            code: "VALIDATION_ERROR",
            message: "Invalid payload.",
            details: {
                field: "phoneNumberE164",
            },
        });

        expect(mockIdempotencyUpdate).toHaveBeenCalledTimes(2);
    });
});
