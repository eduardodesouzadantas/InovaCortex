import { withApiLogging } from "@/lib/logger";
import { authenticateAndRateLimitPublicApiRequest, publicApiErrorResponse, type PublicApiRateLimitInfo } from "@/lib/public-api/v1-auth";
import { publicApiSuccessResponse, resolvePublicApiRequestId } from "@/lib/public-api/v1-response";

export const runtime = "nodejs";

async function GETHandler(request: Request) {
    const requestId = resolvePublicApiRequestId(request);
    let rateLimit: PublicApiRateLimitInfo | undefined;
    try {
        const authResult = await authenticateAndRateLimitPublicApiRequest(request, {
            routeKey: "public:v1:root:get",
            limit: 120,
        });
        rateLimit = authResult.rateLimit;
        const { context } = authResult;
        const data = {
            version: "v1",
            organization: {
                id: context.organizationId,
                slug: context.organizationSlug,
                name: context.organizationName,
            },
            authentication: {
                scheme: "Bearer",
                keyPrefix: context.apiKeyPrefix,
            },
            availableResources: [
                { path: "/api/public/v1/contacts", methods: ["GET", "POST"] },
                { path: "/api/public/v1/deals", methods: ["GET", "POST"] },
                { path: "/api/public/v1/activities", methods: ["GET", "POST"] },
                { path: "/api/public/v1/conversations", methods: ["GET"] },
                { path: "/api/public/v1/executive/pulse", methods: ["GET"] },
            ],
        };

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

export const GET = withApiLogging("/api/public/v1", "GET", GETHandler);
