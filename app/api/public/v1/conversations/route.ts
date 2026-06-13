import { withApiLogging } from "@/lib/logger";
import { authenticateAndRateLimitPublicApiRequest, publicApiErrorResponse, type PublicApiRateLimitInfo } from "@/lib/public-api/v1-auth";
import { parsePublicApiPagination } from "@/lib/public-api/v1-pagination";
import { publicApiSuccessResponse, resolvePublicApiRequestId } from "@/lib/public-api/v1-response";
import { listPublicConversations } from "@/lib/public-api/v1-service";

export const runtime = "nodejs";

async function GETHandler(request: Request) {
    const requestId = resolvePublicApiRequestId(request);
    let rateLimit: PublicApiRateLimitInfo | undefined;
    try {
        const authResult = await authenticateAndRateLimitPublicApiRequest(request, {
            routeKey: "public:v1:conversations:get",
            limit: 90,
        });
        rateLimit = authResult.rateLimit;
        const { context } = authResult;
        const pagination = parsePublicApiPagination(new URL(request.url).searchParams, {
            defaultLimit: 25,
            maxLimit: 100,
        });
        const data = await listPublicConversations({
            organizationId: context.organizationId,
            offset: pagination.offset,
            limit: pagination.limit,
        });

        return publicApiSuccessResponse(request, {
            items: data.items,
            summary: data.summary,
        }, {
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

export const GET = withApiLogging("/api/public/v1/conversations", "GET", GETHandler);
