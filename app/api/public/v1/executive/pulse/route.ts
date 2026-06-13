import { withApiLogging } from "@/lib/logger";
import { authenticateAndRateLimitPublicApiRequest, publicApiErrorResponse, type PublicApiRateLimitInfo } from "@/lib/public-api/v1-auth";
import { publicApiSuccessResponse, resolvePublicApiRequestId } from "@/lib/public-api/v1-response";
import { getPublicExecutivePulse } from "@/lib/public-api/v1-service";

export const runtime = "nodejs";

async function GETHandler(request: Request) {
    const requestId = resolvePublicApiRequestId(request);
    let rateLimit: PublicApiRateLimitInfo | undefined;
    try {
        const authResult = await authenticateAndRateLimitPublicApiRequest(request, {
            routeKey: "public:v1:executive:pulse:get",
            limit: 30,
        });
        rateLimit = authResult.rateLimit;
        const { context } = authResult;
        const data = await getPublicExecutivePulse({
            organizationSlug: context.organizationSlug,
        });

        return publicApiSuccessResponse(request, data, {
            requestId,
            rateLimit,
        });
    } catch (error) {
        return publicApiErrorResponse(request, error, {
            requestId,
            rateLimit,
        });
    }
}

export const GET = withApiLogging("/api/public/v1/executive/pulse", "GET", GETHandler);
