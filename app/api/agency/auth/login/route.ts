import { withApiLogging } from "@/lib/logger";
export const runtime = "nodejs";

import { loginWithPassword } from "@/lib/auth/login-service";

/**
 * POST /api/agency/auth/login
 * Official agency login endpoint.
 */
async function POSTHandler(request: Request) {
    return loginWithPassword(request, {
        endpoint: "agency",
        requireScope: "agency",
    });
}

export const POST = withApiLogging("/api/agency/auth/login", "POST", POSTHandler);
