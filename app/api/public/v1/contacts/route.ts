import { withApiLogging } from "@/lib/logger";
import { PublicApiError, authenticateAndRateLimitPublicApiRequest, publicApiErrorResponse, type PublicApiRateLimitInfo } from "@/lib/public-api/v1-auth";
import { beginPublicApiIdempotency, finalizePublicApiIdempotencyError, finalizePublicApiIdempotencySuccess, resolvePublicApiIdempotencyKey } from "@/lib/public-api/v1-idempotency";
import { parsePublicApiPagination } from "@/lib/public-api/v1-pagination";
import { publicApiErrorResponse as buildPublicApiErrorResponse, publicApiSuccessResponse, resolvePublicApiRequestId } from "@/lib/public-api/v1-response";
import { createPublicContact, listPublicContacts } from "@/lib/public-api/v1-service";
import { normalizePhone } from "@/lib/whatsapp";

export const runtime = "nodejs";

async function GETHandler(request: Request) {
    const requestId = resolvePublicApiRequestId(request);
    let rateLimit: PublicApiRateLimitInfo | undefined;
    try {
        const authResult = await authenticateAndRateLimitPublicApiRequest(request, {
            routeKey: "public:v1:contacts:get",
            limit: 120,
        });
        rateLimit = authResult.rateLimit;
        const { context } = authResult;
        const pagination = parsePublicApiPagination(new URL(request.url).searchParams, {
            defaultLimit: 25,
            maxLimit: 100,
        });
        const data = await listPublicContacts({
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
            routeKey: "public:v1:contacts:post",
            limit: 60,
        });
        rateLimit = authResult.rateLimit;
        const { context } = authResult;
        const rawBody = await request.text();
        let body: {
            phoneNumberE164?: string;
            name?: string | null;
            email?: string | null;
            lifecycle?: string | null;
            tags?: string[] | null;
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
                routeKey: "public:v1:contacts:post",
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

        const phoneNumberE164 = typeof body.phoneNumberE164 === "string" ? normalizePhone(body.phoneNumberE164) : "";
        if (!phoneNumberE164) {
            throw new PublicApiError("phoneNumberE164 is required.", 400, "VALIDATION_ERROR");
        }

        const data = await createPublicContact({
            organizationId: context.organizationId,
            phoneNumberE164,
            name: body.name ?? null,
            email: body.email ?? null,
            lifecycle: body.lifecycle ?? null,
            tags: body.tags ?? null,
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

export const GET = withApiLogging("/api/public/v1/contacts", "GET", GETHandler);
export const POST = withApiLogging("/api/public/v1/contacts", "POST", POSTHandler);
