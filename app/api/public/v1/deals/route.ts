import { withApiLogging } from "@/lib/logger";
import { PublicApiError, authenticateAndRateLimitPublicApiRequest, publicApiErrorResponse, type PublicApiRateLimitInfo } from "@/lib/public-api/v1-auth";
import { beginPublicApiIdempotency, finalizePublicApiIdempotencyError, finalizePublicApiIdempotencySuccess, resolvePublicApiIdempotencyKey } from "@/lib/public-api/v1-idempotency";
import { parsePublicApiPagination } from "@/lib/public-api/v1-pagination";
import { publicApiErrorResponse as buildPublicApiErrorResponse, publicApiSuccessResponse, resolvePublicApiRequestId } from "@/lib/public-api/v1-response";
import { createPublicDeal, listPublicDeals } from "@/lib/public-api/v1-service";

export const runtime = "nodejs";

async function GETHandler(request: Request) {
    const requestId = resolvePublicApiRequestId(request);
    let rateLimit: PublicApiRateLimitInfo | undefined;
    try {
        const authResult = await authenticateAndRateLimitPublicApiRequest(request, {
            routeKey: "public:v1:deals:get",
            limit: 90,
        });
        rateLimit = authResult.rateLimit;
        const { context } = authResult;
        const pagination = parsePublicApiPagination(new URL(request.url).searchParams, {
            defaultLimit: 25,
            maxLimit: 100,
        });
        const data = await listPublicDeals({
            organizationId: context.organizationId,
            offset: pagination.offset,
            limit: pagination.limit,
        });

        return publicApiSuccessResponse(request, data.items, {
            requestId,
            rateLimit,
            pagination: data.pagination,
        });
    } catch (error) {
        return publicApiErrorResponse(request, error, {
            requestId,
            rateLimit,
        });
    }
}

async function POSTHandler(request: Request) {
    let idempotencyRecordId: string | null = null;
    const requestId = resolvePublicApiRequestId(request);
    let rateLimit: PublicApiRateLimitInfo | undefined;
    try {
        const authResult = await authenticateAndRateLimitPublicApiRequest(request, {
            routeKey: "public:v1:deals:post",
            limit: 45,
        });
        rateLimit = authResult.rateLimit;
        const { context } = authResult;
        const rawBody = await request.text();
        let body: {
            contactId?: string;
            stageId?: string | null;
            value?: number | null;
            status?: string | null;
        } = {};
        let parsedJson = false;

        try {
            body = rawBody.trim() ? JSON.parse(rawBody) : {};
            parsedJson = true;
        } catch {
            body = {};
        }

        const idempotencyKey = resolvePublicApiIdempotencyKey(request);
        const idempotency = idempotencyKey
            ? await beginPublicApiIdempotency({
                organizationId: context.organizationId,
                routeKey: "public:v1:deals:post",
                idempotencyKey,
                payload: parsedJson ? body : rawBody,
            })
            : { kind: "skipped" as const };

        if (idempotency.kind === "replay") {
            if (idempotency.replay.kind === "success") {
                return publicApiSuccessResponse(request, idempotency.replay.data, {
                    status: idempotency.replay.responseStatus,
                    requestId,
                    rateLimit,
                });
            }

            return buildPublicApiErrorResponse(request, {
                code: idempotency.replay.code,
                message: idempotency.replay.message,
                ...(typeof idempotency.replay.details === "undefined" ? {} : { details: idempotency.replay.details }),
            }, {
                status: idempotency.replay.responseStatus,
                requestId,
                rateLimit,
            });
        }

        if (idempotency.kind === "claimed") {
            idempotencyRecordId = idempotency.recordId;
        }

        if (!body.contactId || typeof body.contactId !== "string" || !body.contactId.trim()) {
            throw new PublicApiError("contactId is required.", 400, "VALIDATION_ERROR");
        }

        const data = await createPublicDeal({
            organizationId: context.organizationId,
            contactId: body.contactId.trim(),
            stageId: body.stageId ?? null,
            value: typeof body.value === "number" ? body.value : null,
            status: body.status ?? null,
        });

        if (idempotency.kind === "claimed") {
            await finalizePublicApiIdempotencySuccess({
                recordId: idempotencyRecordId!,
                responseStatus: 201,
                data,
            });
        }

        return publicApiSuccessResponse(request, data, {
            status: 201,
            requestId,
            rateLimit,
        });
    } catch (error) {
        if (idempotencyRecordId) {
            await finalizePublicApiIdempotencyError({
                recordId: idempotencyRecordId,
                responseStatus: error instanceof PublicApiError ? error.status : 500,
                code: error instanceof PublicApiError ? error.code : "INTERNAL_ERROR",
                message: error instanceof PublicApiError ? error.message : "Internal Server Error",
                ...(error instanceof PublicApiError && typeof error.details !== "undefined" ? { details: error.details } : {}),
            });
        }

        return publicApiErrorResponse(request, error, {
            requestId,
            rateLimit,
        });
    }
}

export const GET = withApiLogging("/api/public/v1/deals", "GET", GETHandler);
export const POST = withApiLogging("/api/public/v1/deals", "POST", POSTHandler);
